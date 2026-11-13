import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;
const norm = (n) => String(n ?? "").trim().replace(/^@/, "").toLowerCase();

export async function listGreetings(channel) {
    const { rows } = await pool.query(
        `SELECT username, message, enabled, last_stream_id FROM chat_greetings WHERE channel = $1 ORDER BY username;`,
        [ch(channel)],
    );
    return rows;
}

/** Legt eine Begrüßung an oder ändert sie (der Text ist neu, die Begrüßung gilt dann auch im laufenden Stream wieder als offen nicht - siehe markGreeted). */
export async function saveGreeting(channel, username, message) {
    await ensureChannel(channel);
    const name = norm(username);
    await pool.query(
        `INSERT INTO chat_greetings (channel, username, message) VALUES ($1, $2, $3)
         ON CONFLICT (channel, username) DO UPDATE SET message = EXCLUDED.message;`,
        [ch(channel), name, message],
    );
    return name;
}

export async function setGreetingEnabled(channel, username, enabled) {
    const { rowCount } = await pool.query(`UPDATE chat_greetings SET enabled = $3 WHERE channel = $1 AND username = $2;`, [ch(channel), norm(username), enabled]);
    return rowCount > 0;
}

export async function deleteGreeting(channel, username) {
    const { rowCount } = await pool.query(`DELETE FROM chat_greetings WHERE channel = $1 AND username = $2;`, [ch(channel), norm(username)]);
    return rowCount > 0;
}

/**
 * Merkt sich atomar, dass der Nutzer in diesem Stream begrüßt wurde. Liefert den Text nur, wenn er in diesem Stream noch
 * NICHT begrüßt wurde (mehrere gleichzeitige Nachrichten lösen so nur eine Begrüßung aus), sonst null.
 */
export async function markGreeted(channel, username, streamId) {
    const { rows } = await pool.query(
        `UPDATE chat_greetings SET last_stream_id = $3
         WHERE channel = $1 AND username = $2 AND enabled AND last_stream_id IS DISTINCT FROM $3
         RETURNING message;`,
        [ch(channel), norm(username), String(streamId)],
    );
    return rows[0]?.message ?? null;
}
