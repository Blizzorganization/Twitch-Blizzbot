import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { apiConfigured, probeToken, BOT_KEY, botTokenStatus } from "../twitch/api/tokens.js";

/**
 * Token-Überwachung: prüft regelmäßig, ob die gespeicherten Twitch-Tokens noch gültig sind, und zeigt Probleme im
 * Dashboard (Übersicht) und im Log an, bevor etwas im Betrieb ausfällt. Ein abgelaufener Access-Token ist dabei kein
 * Problem (er wird automatisch erneuert) - gemeldet wird nur, wenn auch die Erneuerung nicht mehr geht.
 */
const CHECK_INTERVAL_MS = 6 * 3600 * 1000;
const FIRST_CHECK_DELAY_MS = 45 * 1000;
const CHAT_WARN_DAYS = 7;

let problems = []; // { scope: "channel" | "bot" | "chat", channel?, level: "warn"|"error", message }
let checkedAt = null;
let timers = [];
let running = null;
let logged = new Set();

/** Prüft den statischen Chat-Token (nur wenn kein Refresh-Token gesetzt ist; sonst erneuert twurple ihn selbst). */
async function checkChatToken() {
    const { accessToken, refreshToken } = config.twitch.chatAuth;
    if (!accessToken || refreshToken) return null;
    try {
        const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${accessToken}` } });
        if (res.status === 401) {
            return { scope: "chat", level: "error", message: "Der Chat-Token (TWITCH_OAUTH_TOKEN) ist abgelaufen oder ungültig. Neuen Token erzeugen und in der .env eintragen – oder TWITCH_BOT_REFRESH_TOKEN setzen, dann erneuert der Bot ihn selbst." };
        }
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        if (data.expires_in > 0) {
            const days = Math.floor(data.expires_in / 86400);
            if (days < CHAT_WARN_DAYS) {
                return { scope: "chat", level: "warn", message: `Der Chat-Token (TWITCH_OAUTH_TOKEN) läuft in ${days < 1 ? "weniger als einem Tag" : `${days} Tag${days === 1 ? "" : "en"}`} ab. Rechtzeitig einen neuen eintragen – oder TWITCH_BOT_REFRESH_TOKEN setzen, dann erneuert der Bot ihn selbst.` };
            }
        }
    } catch {
        // Twitch nicht erreichbar: kein Alarm
    }
    return null;
}

async function check() {
    if (!apiConfigured()) return;
    const found = [];
    for (const channel of config.twitch.channels) {
        const r = await probeToken(channel);
        if (r.status === "invalid") {
            found.push({ scope: "channel", channel, level: "error", message: `Der Streamer-Token für ${channel} ist ungültig oder widerrufen. Im Dashboard unter Verwaltung → Benutzer → Twitch-Autorisierung neu autorisieren.` });
        }
    }
    if ((await botTokenStatus()).hasToken) {
        const r = await probeToken(BOT_KEY);
        if (r.status === "invalid") {
            found.push({ scope: "bot", level: "error", message: "Der Bot-Account-Token ist ungültig oder widerrufen. Im Dashboard unter Verwaltung → Benutzer → „Bot-Account autorisieren“ neu autorisieren." });
        }
    }
    const chat = await checkChatToken();
    if (chat) found.push(chat);

    problems = found;
    checkedAt = new Date();
    // Nur Änderungen loggen (neues Problem / Problem behoben), nicht bei jeder Prüfung dasselbe
    const keys = new Set(found.map((p) => `${p.scope}:${p.channel ?? ""}:${p.level}`));
    for (const p of found) if (!logged.has(`${p.scope}:${p.channel ?? ""}:${p.level}`)) logger.warn(`Token-Prüfung: ${p.message}`);
    for (const k of logged) if (!keys.has(k)) logger.info(`Token-Prüfung: Problem "${k}" ist behoben.`);
    logged = keys;
}

/** Prüft jetzt (parallele Aufrufe teilen sich eine Prüfung). Fehler werden geloggt, nicht geworfen. */
export function runTokenHealthCheck() {
    if (!running) {
        running = check()
            .catch((e) => logger.warn(`Token-Prüfung fehlgeschlagen: ${e.message}`))
            .finally(() => { running = null; });
    }
    return running;
}

/** Probleme für die Übersicht: Streamer-Token des Kanals; Bot-Account und Chat-Token nur mit includeGlobal (Admins). */
export function tokenProblems(channel, includeGlobal) {
    return problems
        .filter((p) => (p.scope === "channel" ? p.channel === channel : includeGlobal))
        .map(({ level, message }) => ({ level, message }));
}

export const tokenCheckedAt = () => checkedAt;

export function startTokenHealth() {
    stopTokenHealth();
    const first = setTimeout(() => runTokenHealthCheck(), FIRST_CHECK_DELAY_MS);
    const every = setInterval(() => runTokenHealthCheck(), CHECK_INTERVAL_MS);
    first.unref?.();
    every.unref?.();
    timers = [first, every];
}

export function stopTokenHealth() {
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers = [];
}
