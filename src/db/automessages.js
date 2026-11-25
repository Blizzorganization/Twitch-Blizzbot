import fs from "node:fs";
import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { logger } from "../utils/logger.js";

export async function listAutomessages(channel) {
    const { rows } = await pool.query(`SELECT id, message, delay_minutes, standalone FROM automessages WHERE channel = $1 ORDER BY id;`, [
        cleanChannel(channel),
    ]);
    return rows;
}

/** delayMinutes: eigenes Intervall (Minuten) für diese Nachricht; null/0 = Standard-Intervall des Kanals verwenden. */
export async function addAutomessage(channel, message, delayMinutes = null) {
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO automessages (channel, message, delay_minutes) VALUES ($1, $2, $3) RETURNING id;`,
        [cleanChannel(channel), message, delayMinutes || null],
    );
    return rows[0].id;
}

export async function updateAutomessage(channel, id, { message, delayMinutes, standalone } = {}) {
    const hasDelay = delayMinutes !== undefined;
    const res = await pool.query(
        `UPDATE automessages SET
            message = COALESCE($3, message),
            delay_minutes = CASE WHEN $4 THEN $5 ELSE delay_minutes END,
            standalone = COALESCE($6, standalone)
         WHERE channel = $1 AND id = $2;`,
        [cleanChannel(channel), id, message ?? null, hasDelay, hasDelay ? delayMinutes || null : null, standalone ?? null],
    );
    return res.rowCount > 0;
}

export async function deleteAutomessage(channel, id) {
    const res = await pool.query(`DELETE FROM automessages WHERE channel = $1 AND id = $2;`, [cleanChannel(channel), id]);
    return res.rowCount > 0;
}

/** Automessage pro Kanal an-/ausschalten (Spalte streamer.automessage aus dem alten Schema). */
export async function setAutomessageEnabled(channel, enabled) {
    await ensureChannel(channel);
    await pool.query(`UPDATE streamer SET automessage = $2 WHERE name = $1;`, [cleanChannel(channel), enabled]);
}

export async function isAutomessageEnabled(channel) {
    const { rows } = await pool.query(`SELECT automessage FROM streamer WHERE name = $1;`, [cleanChannel(channel)]);
    return rows[0]?.automessage ?? true;
}

/**
 * Übernimmt die Nachrichten aus der alten configs/automessages.json ({"kanal": ["text", ...]}),
 * aber nur für Kanäle, die in der Datenbank noch keine Automessages haben.
 */
export async function importAutomessagesFile(file = "configs/automessages.json") {
    if (!fs.existsSync(file)) return;
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        logger.warn(`${file} konnte nicht gelesen werden: ${e.message}`);
        return;
    }
    for (const [channel, messages] of Object.entries(data)) {
        if (!Array.isArray(messages) || channel === "channelname") continue; // "channelname" = Platzhalter der alten Vorlage
        if ((await listAutomessages(channel)).length > 0) continue;
        for (const m of messages) if (typeof m === "string" && m.trim()) await addAutomessage(channel, m.trim());
        logger.info(`Automessages für ${channel} aus ${file} importiert (${messages.length}).`);
    }
}
