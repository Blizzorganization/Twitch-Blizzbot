import "./network.js"; // zuerst: IPv4 bevorzugen (siehe network.js)
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { pool, measureDb } from "./db/pool.js";
import { ensureTables } from "./db/init.js";
import { startTwitchBot, stopTwitchBot } from "./twitch/bot.js";
import { startDiscordBot, stopDiscordBot, sendBlacklist } from "./discord/bot.js";
import { hooks } from "./twitch/commands.js";
import { importAutomessagesFile } from "./db/automessages.js";
import { startWebServer } from "./dashboard/server.js";
import { deleteOldAuditLog } from "./db/audit.js";
import { runNetworkDiagnose } from "./utils/netdiag.js";
import { startTokenHealth, stopTokenHealth } from "./services/token-health.js";

let webServer; // http.Server von startWebServer(), für ein sauberes .close() beim Beenden

const AUDIT_LOG_RETENTION_DAYS = 3;
const AUDIT_LOG_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // stündlich reicht, Einträge sind ohnehin nur 3 Tage gültig

/** Löscht Audit-Log-Einträge älter als AUDIT_LOG_RETENTION_DAYS (Dashboard-Tab "Audit-Log"). */
async function cleanupAuditLog() {
    try {
        const n = await deleteOldAuditLog(AUDIT_LOG_RETENTION_DAYS);
        if (n > 0) logger.info(`Audit-Log: ${n} Einträge älter als ${AUDIT_LOG_RETENTION_DAYS} Tage gelöscht.`);
    } catch (e) {
        logger.warn(`Audit-Log-Aufräumen fehlgeschlagen: ${e.message}`);
    }
}

/** Führt einen Start-Schritt aus und meldet, wie lange er gedauert hat (hilft bei der Suche nach Bremsen). */
async function timed(label, fn) {
    const t = Date.now();
    try {
        return await fn();
    } finally {
        logger.diag(`Start: ${label} - ${Date.now() - t} ms`);
    }
}

async function main() {
    const started = Date.now();
    logger.info("Starte Blizzbot v2 ...");
    await timed("Datenbank-Verbindung", async () => {
        const { connectMs, queryMs } = await measureDb();
        logger.diag(`Datenbank (${config.db.host}:${config.db.port}): Verbindungsaufbau ${connectMs} ms, Abfrage ${queryMs} ms`);
        if (connectMs > 500) logger.warn("Der Verbindungsaufbau zur Datenbank ist langsam. Bei PGHOST=localhost hilft oft PGHOST=127.0.0.1 in configs/.env.");
    });
    await timed("Datenbank-Schema", () => ensureTables());
    await timed("Automessages-Import", () => importAutomessagesFile()); // übernimmt configs/automessages.json des alten Bots (nur für Kanäle ohne Einträge)

    await timed("Audit-Log aufräumen", () => cleanupAuditLog());
    setInterval(cleanupAuditLog, AUDIT_LOG_CLEANUP_INTERVAL_MS);

    if (config.web.enabled) webServer = startWebServer();

    if (config.discord.enabled) {
        if (config.discord.blacklistChannelId) hooks.sendBlacklist = sendBlacklist; // !blacklist im Twitch-Chat -> Discord
        startDiscordBot().catch((e) => logger.error("Discord-Bot konnte nicht starten:", e));
    }

    if (process.env.DIAGNOSE === "true") runNetworkDiagnose(); // Hintergrund-Test: warum sind Anfragen an Twitch (un)schnell?
    await timed("Twitch-Verbindung", () => startTwitchBot());
    startTokenHealth(); // regelmäßige Token-Prüfung (Warnung in der Übersicht)
    logger.diag(`Start abgeschlossen nach ${Date.now() - started} ms.`);
}

/**
 * Fährt den Bot sauber herunter: trennt Twitch, Discord, den Web-Server und die Datenbank-Verbindung,
 * jeweils mit eigenem try/catch, damit ein einzelner Fehler die anderen Schritte nicht blockiert.
 * Ein zweites Mal gedrückt (oder ein zweites Signal) während des Herunterfahrens wird ignoriert,
 * statt den Vorgang doppelt anzustoßen - genau das hat bisher zu den gelegentlichen Abstürzen geführt.
 */
let shuttingDown = false;
async function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Fahre Blizzbot sauber herunter (${reason}) ...`);

    // Ein Fallback-Timer erzwingt den Exit, falls ein Schritt unten hängen bleibt (z. B. eine
    // Netzwerkverbindung, die nicht mehr antwortet) - sonst würde der Prozess nie beendet.
    const forceExit = setTimeout(() => {
        logger.warn("Sauberes Herunterfahren hat zu lange gedauert - erzwinge Beenden.");
        process.exit(1);
    }, 8000);
    forceExit.unref();

    stopTokenHealth();
    const steps = [
        ["Twitch (Chat, EventSub, Moderator-Aktionen)", () => stopTwitchBot()],
        ["Discord", () => stopDiscordBot()],
        ["Web-Server", () => webServer && new Promise((resolve) => webServer.close(() => resolve()))],
        ["Datenbank", () => pool.end()],
    ];
    for (const [name, fn] of steps) {
        try {
            await fn();
        } catch (e) {
            logger.warn(`${name} konnte nicht sauber getrennt werden: ${e?.message ?? e}`);
        }
    }

    clearTimeout(forceExit);
    logger.info("Blizzbot wurde sauber beendet.");
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT, z. B. Strg+C"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Ohne diese beiden Handler würde Node bei einem unerwarteten Fehler (z. B. eine abgebrochene
// Netzwerkverbindung, deren Promise niemand abgefangen hat) sofort und unkontrolliert abstürzen,
// statt wenigstens zu versuchen, noch sauber herunterzufahren.
process.on("unhandledRejection", (e) => logger.error("Unhandled rejection:", e));
process.on("uncaughtException", (e) => {
    logger.error("Uncaught exception:", e);
    shutdown("uncaughtException");
});

main().catch((e) => {
    logger.error("Start fehlgeschlagen:", e);
    process.exit(1);
});
