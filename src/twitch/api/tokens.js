import { config } from "../../config.js";
import { pool } from "../../db/pool.js";
import { logger } from "../../utils/logger.js";
import { cleanChannel } from "../../db/init.js";

/** Twitch-Tokens: Streamer-Token pro Kanal, Bot-Account-Token, Erneuerung (Refresh) und Zwischenspeicher. */

const OAUTH = "https://id.twitch.tv/oauth2/token";

export const BOT_KEY = "__bot__"; // Schlüssel des Bot-Account-Tokens in der tokens-Map (statt eines Kanalnamens)

const tokens = new Map(); // channel (oder BOT_KEY) -> { access, refresh }

export const idCache = new Map(); // channel -> broadcaster_id

export const apiConfigured = () =>
    !!(config.twitchApi.clientId && config.twitchApi.clientSecret);

/** Token-Quelle: zuletzt gespeicherter Token aus der DB, sonst .env (Fallback für jeden Kanal ohne eigenen DB-Eintrag). */
async function getTokens(channel) {
    if (tokens.has(channel)) return tokens.get(channel);
    if (channel === BOT_KEY) {
        const bot = await pool.query(`SELECT access_token, refresh_token FROM twitch_bot_token WHERE id = 1;`);
        if (!bot.rows[0]) throw new Error("Es ist kein Bot-Account autorisiert.");
        const t = { access: bot.rows[0].access_token, refresh: bot.rows[0].refresh_token };
        tokens.set(channel, t);
        return t;
    }
    const { rows } = await pool.query(`SELECT access_token, refresh_token FROM twitch_tokens WHERE channel = $1;`, [channel]);
    const t = rows[0] ? { access: rows[0].access_token, refresh: rows[0].refresh_token } : null;
    if (!t || (!t.access && !t.refresh)) throw new Error("Für diesen Kanal ist kein Twitch-API-Token hinterlegt.");
    tokens.set(channel, t);
    return t;
}

const refreshing = new Map(); // channel (oder BOT_KEY) -> laufender Refresh

/**
 * Erneuert den Token. Mehrere gleichzeitige Anfragen (z. B. Watchtime + Automessage im selben Moment) teilen sich
 * EINEN Refresh, statt jeweils einen eigenen zu starten - sonst wird derselbe Refresh-Token doppelt eingelöst
 * (doppelte Log-Zeile, im schlimmsten Fall ein ungültiger Token).
 */
export function refresh(channel, staleAccess = null) {
    // staleAccess = der Access-Token, mit dem der Aufrufer gerade gescheitert ist bzw. den er als abgelaufen erkannt hat.
    // Ist der aktuelle Token ein anderer, hat ein paralleler Aufruf ihn schon erneuert -> einfach den nehmen.
    const cur = tokens.get(channel);
    if (staleAccess && cur?.access && cur.access !== staleAccess) return Promise.resolve(cur);
    let p = refreshing.get(channel);
    if (!p) {
        p = doRefresh(channel).finally(() => refreshing.delete(channel));
        refreshing.set(channel, p);
    }
    return p;
}

async function doRefresh(channel) {
    const t = await getTokens(channel);
    const { clientId, clientSecret } = config.twitchApi;
    if (!t.refresh || !clientSecret) {
        throw new Error("Token abgelaufen und kein Refresh möglich (TWITCH_CLIENT_SECRET fehlt oder der Kanal ist noch nicht im Dashboard autorisiert).");
    }
    const res = await fetch(OAUTH, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: t.refresh,
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Token-Refresh fehlgeschlagen: ${data.message ?? res.status}`);
    // expires_in (Sekunden) merken, damit das Token proaktiv erneuert wird, BEVOR eine Anfrage mit 401 fehlschlägt.
    const next = {
        access: data.access_token,
        refresh: data.refresh_token ?? t.refresh,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    };
    tokens.set(channel, next);
    if (channel === BOT_KEY) {
        await pool.query(`UPDATE twitch_bot_token SET access_token = $1, refresh_token = $2, updated_at = now() WHERE id = 1;`, [next.access, next.refresh]);
    } else {
        await pool.query(
            `INSERT INTO twitch_tokens (channel, access_token, refresh_token) VALUES ($1, $2, $3)
             ON CONFLICT (channel) DO UPDATE SET access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token, updated_at = now();`,
            [channel, next.access, next.refresh],
        );
    }
    logger.info(`Twitch-API-Token für ${channel} erneuert (gültig bis ${next.expiresAt ? new Date(next.expiresAt).toLocaleString("de-DE") : "unbekannt"}).`);
    return next;
}

/**
 * Prüft einen gespeicherten Token bei Twitch (Kanal oder BOT_KEY), ohne ihn zu benutzen. Ist der Access-Token abgelaufen,
 * wird er mit dem Refresh-Token erneuert (der Normalfall alle paar Stunden). Nur wenn auch das scheitert, gilt er als ungültig.
 * @returns {Promise<{status: "ok"|"missing"|"invalid"|"unknown", error?: string}>} "unknown" = Twitch nicht erreichbar o. ä. (kein Alarm)
 */
export async function probeToken(channel) {
    let t;
    try {
        t = await getTokens(channel);
    } catch {
        return { status: "missing" };
    }
    try {
        const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${t.access}` } });
        if (res.ok) return { status: "ok" };
        if (res.status !== 401) return { status: "unknown", error: `Twitch antwortet mit Status ${res.status}` };
        try {
            await refresh(channel, t.access);
            return { status: "ok" };
        } catch (e) {
            // Twitch hat den Refresh-Token ausdrücklich abgelehnt (widerrufen, Passwort geändert, App neu erstellt) -> ungültig;
            // alles andere (z. B. Netzwerkfehler) ist nur "unbekannt"
            return /Token-Refresh fehlgeschlagen|kein Refresh möglich/.test(e.message) ? { status: "invalid", error: e.message } : { status: "unknown", error: e.message };
        }
    } catch (e) {
        return { status: "unknown", error: e.message };
    }
}

/** Erneuert das Token proaktiv, wenn es (nach einem vorherigen Refresh) in weniger als 60s abläuft. */
export async function ensureFreshToken(channel) {
    let t = await getTokens(channel);
    if (t.expiresAt && Date.now() >= t.expiresAt - 60_000) {
        t = await refresh(channel, t.access);
    }
    return t;
}

let botIdentity; // undefined = noch nicht geladen, null = kein Bot-Account hinterlegt, sonst { id, login }

/** Der autorisierte Bot-Account ({ id, login }) oder null. */
export async function getBotIdentity() {
    if (botIdentity !== undefined) return botIdentity;
    const { rows } = await pool.query(`SELECT user_id, login FROM twitch_bot_token WHERE id = 1;`);
    botIdentity = rows[0] ? { id: rows[0].user_id, login: rows[0].login } : null;
    return botIdentity;
}

export async function storeBotToken(accessToken, refreshToken, userId, login) {
    await pool.query(
        `INSERT INTO twitch_bot_token (id, access_token, refresh_token, user_id, login) VALUES (1, $1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
            user_id = EXCLUDED.user_id, login = EXCLUDED.login, updated_at = now();`,
        [accessToken, refreshToken, userId, login ?? null],
    );
    tokens.delete(BOT_KEY);
    botIdentity = { id: userId, login: login ?? null };
}

/** Entfernt den Bot-Account-Token; danach übernimmt wieder der Streamer-Token. */
export async function removeBotToken() {
    await pool.query(`DELETE FROM twitch_bot_token WHERE id = 1;`);
    tokens.delete(BOT_KEY);
    botIdentity = null;
}

export async function botTokenStatus() {
    const { rows } = await pool.query(`SELECT user_id, login, updated_at FROM twitch_bot_token WHERE id = 1;`);
    return rows[0] ? { hasToken: true, userId: rows[0].user_id, login: rows[0].login, updatedAt: rows[0].updated_at } : { hasToken: false };
}

/** Verwirft den zwischengespeicherten Token für einen Kanal, damit beim nächsten Request neu aus der DB gelesen wird. */
export function invalidateTokenCache(channel) {
    tokens.delete(cleanChannel(channel));
}

/** Speichert einen (neu autorisierten) Token für einen Kanal (optional mit der zugehörigen Broadcaster-User-ID) und verwirft den Zwischenspeicher dafür. */
export async function storeToken(channel, accessToken, refreshToken, broadcasterId = null) {
    channel = cleanChannel(channel);
    await pool.query(
        `INSERT INTO twitch_tokens (channel, access_token, refresh_token, broadcaster_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (channel) DO UPDATE SET access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            broadcaster_id = COALESCE(EXCLUDED.broadcaster_id, twitch_tokens.broadcaster_id), updated_at = now();`,
        [channel, accessToken, refreshToken, broadcasterId],
    );
    invalidateTokenCache(channel);
    if (broadcasterId) idCache.set(channel, broadcasterId);
}

/** Pro Kanal: ob ein Token hinterlegt ist und welche Broadcaster-User-ID er laut letzter Autorisierung trägt
 *  (zur Kontrolle im Dashboard, ob für jeden Kanal eines Mehrkanal-Setups ein eigener, passender Token vorliegt). */
export async function listTokenStatus() {
    const { rows } = await pool.query(`SELECT channel, broadcaster_id, updated_at FROM twitch_tokens;`);
    const byChannel = new Map(rows.map((r) => [r.channel, r]));
    return config.twitch.channels.map((channel) => {
        const row = byChannel.get(channel);
        return {
            channel,
            hasToken: !!row,
            broadcasterId: row?.broadcaster_id ?? null,
            updatedAt: row?.updated_at ?? null,
        };
    });
}
