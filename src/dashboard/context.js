/** Gemeinsame Helfer aller Dashboard-Routen: Anmeldung, Rechteprüfung, Kanalzugriff, Fehlerbehandlung. */
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { UserError } from "../utils/errors.js";
import { userCanAccessChannel } from "../db/user-channels.js";
import { verifyToken } from "./auth.js";
import { isWeakSecret, safeEqual, publicErrorMessage } from "./security.js";
import { getStream } from "../twitch/api.js";
import { getUser } from "../db/users.js";

/** Der Notfall-Token zählt nur, wenn er stark genug ist (mind. 16 Zeichen, kein Platzhalter wie "changeme"). */
export const adminTokenUsable = () => !isWeakSecret(config.web.adminToken);

// Ein Anmelde-Token bleibt bis zu 30 Tage gültig - ein inzwischen GELÖSCHTER Benutzer darf damit aber nicht mehr hinein.
// Die Existenz wird deshalb geprüft (10 s zwischengespeichert, beim Löschen sofort verworfen).
// Dasselbe gilt nach einer Passwortänderung: Tokens mit älterer "tv"-Version (Token-Version des Benutzers) sind ungültig.
const userExistsCache = new Map(); // id -> { at, ok, tv }
async function loadUser(id) {
    const c = userExistsCache.get(id);
    if (c && Date.now() - c.at < 10_000) return c;
    const u = await getUser(id);
    const entry = { at: Date.now(), ok: !!u, tv: u?.tokenVersion ?? 0 };
    userExistsCache.set(id, entry);
    return entry;
}
async function tokenStillValid(payload) {
    const u = await loadUser(payload.sub);
    return u.ok && (payload.tv ?? 0) === u.tv;
}

export async function auth(req, res, next) {
    try {
        const header = req.headers.authorization ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : req.headers["x-admin-token"];
        if (!token) return res.status(401).json({ error: "Nicht autorisiert" });
        if (adminTokenUsable() && safeEqual(token, config.web.adminToken)) {
            req.user = { id: 0, username: "admin-token" };
            return next();
        }
        const payload = verifyToken(token);
        if (!payload || !(await tokenStillValid(payload))) return res.status(401).json({ error: "Nicht autorisiert" });
        req.user = { id: payload.sub, username: payload.username };
        next();
    } catch (e) {
        next(e);
    }
}

/** Der admin-token-Notfallzugang (id 0) zählt immer als Haupt-Admin (owner). */
export async function isAdminUser(user) {
    if (user.id === 0) return true;
    const u = await getUser(user.id);
    return !!u?.isAdmin; // true für role "owner" ODER "admin"
}

/** Nur der Haupt-Admin (owner) darf Admins ernennen/degradieren und die Owner-Rolle ist unantastbar. */
export async function isOwnerUser(user) {
    if (user.id === 0) return true;
    const u = await getUser(user.id);
    return !!u?.isOwner;
}

export async function requireAdmin(req, res, next) {
    if (!(await isAdminUser(req.user))) return res.status(403).json({ error: "Dafür sind Administratorrechte nötig." });
    next();
}

export async function requireOwner(req, res, next) {
    if (!(await isOwnerUser(req.user))) return res.status(403).json({ error: "Dafür sind Haupt-Administratorrechte nötig." });
    next();
}

/**
 * Live-Status für die Übersicht - blockiert die Seite nie lange:
 *  - höchstens alle 30 s fragt der Server bei Twitch nach (Zwischenspeicher),
 *  - die Abfrage läuft im Hintergrund weiter (max. 10 s), auch wenn die Seite schon geantwortet hat,
 *  - ist ein älterer Wert da, kommt er sofort; sonst wartet die Seite höchstens 1,5 s und zeigt "Unbekannt".
 * Das Dashboard fragt bei "Unbekannt" nach ein paar Sekunden von selbst noch einmal nach.
 */
const STREAM_TTL_MS = 30_000;
const STREAM_FIRST_WAIT_MS = 1_500;
const STREAM_FETCH_TIMEOUT_MS = 10_000;
const streamCache = new Map(); // channel -> { at, value }
const streamInflight = new Map(); // channel -> Promise (läuft gerade)

function refreshStream(channel) {
    if (streamInflight.has(channel)) return streamInflight.get(channel);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Zeitlimit")), STREAM_FETCH_TIMEOUT_MS).unref?.());
    const p = Promise.race([getStream(channel), timeout])
        .then((st) => {
            const value = { known: true, live: !!st, viewers: st?.viewer_count ?? 0, title: st?.title ?? null, game: st?.game_name ?? null };
            streamCache.set(channel, { at: Date.now(), value });
            return value;
        })
        .catch(() => null) // API/Token nicht verfügbar oder zu langsam
        .finally(() => streamInflight.delete(channel));
    streamInflight.set(channel, p);
    return p;
}

export async function streamStatus(channel) {
    const unknown = { known: false, live: false };
    const cached = streamCache.get(channel);
    if (cached && Date.now() - cached.at < STREAM_TTL_MS) return cached.value;
    const fetching = refreshStream(channel);
    if (cached) return cached.value; // veraltet, aber sofort da; die Aktualisierung läuft im Hintergrund
    const first = await Promise.race([fetching, new Promise((r) => setTimeout(() => r(null), STREAM_FIRST_WAIT_MS).unref?.())]);
    return first ?? unknown;
}

export const wrap = (fn) => (req, res) =>
    fn(req, res).catch((e) => {
        if (e instanceof UserError) return res.status(400).json({ error: e.message });
        logger.error("API-Fehler:", e);
        res.status(500).json({ error: publicErrorMessage(e) });
    });


/** Öffentlich erreichbare Basis-URL des Dashboards - siehe WEB_PUBLIC_URL in config.js. */
export function publicBaseUrl(req) {
    return config.web.publicUrl || `${req.protocol}://${req.get("host")}`;
}

/** Gelöschter Benutzer: sein Anmelde-Token wird sofort ungültig. */
export const forgetUser = (id) => userExistsCache.delete(id);

// req.channel wird von channelAccessMiddleware gesetzt (nach Prüfung der Nutzerrechte); channelOf liest ihn nur noch aus.
export const channelOf = (req) => req.channel;

/** Prüft, ob der angemeldete Benutzer Zugriff auf den angefragten Kanal hat (admin-token = immer alle). */
export async function channelAccessMiddleware(req, res, next) {
    const channel = String(req.query.channel ?? req.body?.channel ?? config.twitch.channels[0] ?? "").toLowerCase();
    if (req.user.id !== 0 && !(await userCanAccessChannel(req.user.id, channel))) {
        return res.status(403).json({ error: "Kein Zugriff auf diesen Kanal." });
    }
    req.channel = channel;
    next();
}

