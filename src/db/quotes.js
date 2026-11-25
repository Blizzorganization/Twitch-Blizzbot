import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

export async function listQuotes(channel) {
    const { rows } = await pool.query(`SELECT id, text, added_by, created_at FROM quotes WHERE channel = $1 ORDER BY id;`, [
        ch(channel),
    ]);
    return rows;
}

export async function getQuote(channel, id) {
    const { rows } = await pool.query(`SELECT id, text, added_by, created_at FROM quotes WHERE channel = $1 AND id = $2;`, [
        ch(channel),
        id,
    ]);
    return rows[0] ?? null;
}

/** Zufälliges Zitat, wie "!zitat" ohne Angabe im alten Bot. */
export async function randomQuote(channel) {
    const { rows } = await pool.query(
        `SELECT id, text, added_by, created_at FROM quotes WHERE channel = $1 ORDER BY random() LIMIT 1;`,
        [ch(channel)],
    );
    return rows[0] ?? null;
}

export async function addQuote(channel, text, addedBy) {
    await ensureChannel(channel);
    const c = ch(channel);
    // Kleinste freie Nummer INNERHALB dieses Kanals: ist z.B. #1 frei (gelöscht), wird wieder #1 vergeben,
    // statt immer weiter hochzuzählen.
    const { rows: free } = await pool.query(
        `SELECT COALESCE(MIN(s.id), 1) AS id
         FROM generate_series(1, (SELECT COALESCE(MAX(id), 0) FROM quotes WHERE channel = $1) + 1) AS s(id)
         WHERE NOT EXISTS (SELECT 1 FROM quotes q WHERE q.channel = $1 AND q.id = s.id);`,
        [c],
    );
    const id = free[0].id;
    const { rows } = await pool.query(
        `INSERT INTO quotes (id, channel, text, added_by) VALUES ($1, $2, $3, $4) RETURNING id, text, added_by, created_at;`,
        [id, c, text, addedBy ?? null],
    );
    return rows[0];
}

export async function deleteQuote(channel, id) {
    const res = await pool.query(`DELETE FROM quotes WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return res.rowCount > 0;
}
