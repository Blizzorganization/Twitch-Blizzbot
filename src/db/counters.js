import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

/** Zähler wie im alten Bot (Tabelle counters: channel, name, cur, inc). */

export async function newCounter(channel, name, inc = 1, start = 0) {
    await ensureChannel(channel);
    const res = await pool.query(
        `INSERT INTO counters (channel, name, cur, inc) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING RETURNING name;`,
        [cleanChannel(channel), name.toLowerCase(), start, inc],
    );
    return res.rowCount > 0;
}

/** Erhöht den Zähler um "inc" und gibt den neuen Wert zurück (wie getCounter im alten Bot). */
export async function getCounter(channel, name) {
    const { rows } = await pool.query(
        `UPDATE counters SET cur = cur + inc WHERE channel = $1 AND name = $2 RETURNING cur;`,
        [cleanChannel(channel), name.toLowerCase()],
    );
    return rows[0]?.cur;
}

export async function delCounter(channel, name) {
    const res = await pool.query(`DELETE FROM counters WHERE channel = $1 AND name = $2;`, [
        cleanChannel(channel),
        name.toLowerCase(),
    ]);
    return res.rowCount > 0;
}

export async function allCounters(channel) {
    const { rows } = await pool.query(`SELECT name, cur, inc FROM counters WHERE channel = $1 ORDER BY name;`, [
        cleanChannel(channel),
    ]);
    return rows;
}

/** Liest den Wert, ohne ihn zu erhöhen (wie readCounter im alten Bot). */
export async function readCounter(channel, name) {
    const { rows } = await pool.query(`SELECT cur FROM counters WHERE channel = $1 AND name = $2;`, [
        cleanChannel(channel),
        name.toLowerCase(),
    ]);
    return rows[0]?.cur;
}

export async function setCounter(channel, name, value) {
    await pool.query(`UPDATE counters SET cur = $3 WHERE channel = $1 AND name = $2;`, [
        cleanChannel(channel),
        name.toLowerCase(),
        value,
    ]);
}

export async function editCounter(channel, name, inc) {
    await pool.query(`UPDATE counters SET inc = $3 WHERE channel = $1 AND name = $2;`, [
        cleanChannel(channel),
        name.toLowerCase(),
        inc,
    ]);
}
