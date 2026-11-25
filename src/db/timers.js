import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

export async function addTimer(channel, text, owner, endsAt) {
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO timers (channel, text, owner, ends_at) VALUES ($1, $2, $3, $4) RETURNING id, channel, text, owner, ends_at;`,
        [ch(channel), text, owner, endsAt],
    );
    return rows[0];
}

export async function listTimers(channel) {
    const { rows } = await pool.query(`SELECT id, channel, text, owner, ends_at FROM timers WHERE channel = $1 ORDER BY ends_at, id;`, [ch(channel)]);
    return rows;
}

export async function allTimers() {
    const { rows } = await pool.query(`SELECT id, channel, text, owner, ends_at FROM timers ORDER BY ends_at, id;`);
    return rows;
}

/** @returns {Promise<boolean>} true, wenn es den Timer gab */
export async function deleteTimer(id) {
    const { rowCount } = await pool.query(`DELETE FROM timers WHERE id = $1;`, [id]);
    return rowCount > 0;
}

/** Löscht alle Timer eines Kanals und gibt deren IDs zurück. */
export async function clearTimers(channel) {
    const { rows } = await pool.query(`DELETE FROM timers WHERE channel = $1 RETURNING id;`, [ch(channel)]);
    return rows.map((r) => r.id);
}
