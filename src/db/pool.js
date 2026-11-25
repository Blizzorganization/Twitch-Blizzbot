import pg from "pg";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

export const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    // Ungenutzte Verbindungen nach 10 s schließen (pg-Standard). Wichtig: Viele Postgres-Server haben einen
    // "idle_session_timeout" und beenden untätige Verbindungen selbst; der Pool schließt sie vorher, sodass
    // das nie als Fehler auftritt. Ein neuer Verbindungsaufbau kostet lokal nur wenige Millisekunden.
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    connectionTimeoutMillis: 15_000,
});

pool.on("error", (err) => {
    // 57P05 = idle-session timeout, 57P01 = Server beendet die Verbindung (Neustart/Admin): der Pool wirft die
    // betroffene Verbindung selbst weg und baut bei der nächsten Anfrage eine neue auf - kein Fehler im Bot.
    if (err?.code === "57P05" || err?.code === "57P01") {
        logger.debug(`Postgres hat eine ungenutzte Verbindung beendet (${err.code}): ${err.message}`);
        return;
    }
    logger.error("Unerwarteter Fehler im Postgres-Pool:", err);
});

/**
 * Kurze Verbindungsaussetzer (Postgres-Neustart, Netzwerkwackler) sollen nicht gleich zu einem fehlgeschlagenen Vorgang
 * führen: scheitert schon der VERBINDUNGSAUFBAU (die Abfrage wurde also noch gar nicht gesendet), wird einmal nach
 * 2 Sekunden erneut versucht. Fehler mitten in einer Abfrage ("Connection terminated unexpectedly") werden bewusst
 * NICHT wiederholt, damit nichts doppelt ausgeführt wird.
 */
const CONNECT_ERROR_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EAI_AGAIN"]);
export function isConnectError(err) {
    const msg = String(err?.message ?? "");
    return (
        CONNECT_ERROR_CODES.has(err?.code) ||
        msg.includes("Connection terminated due to connection timeout") ||
        msg.includes("timeout exceeded when trying to connect")
    );
}
const rawQuery = pool.query.bind(pool);
// Datenbank erreichbar? Nach einem Verbindungsfehler gibt es eine Warnung, bei der nächsten erfolgreichen Abfrage "wieder verbunden".
let dbDown = false;
function noteDbDown(e) {
    if (dbDown) return;
    dbDown = true;
    logger.warn(`Datenbank nicht erreichbar: ${e?.message ?? e}`);
}
function noteDbUp() {
    if (!dbDown) return;
    dbDown = false;
    logger.ok("Datenbank wieder verbunden");
}
const isConnectionLost = (e) => isConnectError(e) || /Connection terminated|ECONNRESET|ECONNREFUSED/.test(String(e?.message ?? e?.code ?? ""));
pool.query = async (...args) => {
    try {
        const res = await rawQuery(...args);
        noteDbUp();
        return res;
    } catch (e) {
        if (isConnectionLost(e)) noteDbDown(e);
        if (!isConnectError(e) || typeof args[args.length - 1] === "function") throw e;
        logger.debug(`Postgres-Verbindung fehlgeschlagen (${e.message}) - neuer Versuch in 2 s`);
        await new Promise((r) => setTimeout(r, 2000));
        try {
            const res = await rawQuery(...args);
            noteDbUp();
            return res;
        } catch (e2) {
            if (isConnectionLost(e2)) noteDbDown(e2);
            throw e2;
        }
    }
};

/** Misst Verbindungsaufbau und eine einfache Abfrage getrennt (zur Fehlersuche bei langsamem Dashboard/Start). */
export async function measureDb() {
    const t0 = Date.now();
    const client = await pool.connect();
    const connectMs = Date.now() - t0;
    try {
        const t1 = Date.now();
        await client.query("SELECT 1");
        return { connectMs, queryMs: Date.now() - t1 };
    } finally {
        client.release();
    }
}

export async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    logger.debug(`SQL (${Date.now() - start}ms): ${text}`);
    return res;
}
