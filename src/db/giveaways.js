import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

export async function listGiveaways(channel, { status } = {}) {
    const { rows } = await pool.query(
        `SELECT * FROM giveaways WHERE channel = $1 AND ($2::text IS NULL OR status = $2) ORDER BY id DESC;`,
        [ch(channel), status ?? null],
    );
    return rows;
}

export async function getGiveaway(channel, id) {
    const { rows } = await pool.query(`SELECT * FROM giveaways WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return rows[0] ?? null;
}

/** Das aktuell offene Giveaway eines Kanals (höchstens eins gleichzeitig). */
export async function getOpenGiveaway(channel) {
    const { rows } = await pool.query(`SELECT * FROM giveaways WHERE channel = $1 AND status = 'open' ORDER BY id DESC LIMIT 1;`, [
        ch(channel),
    ]);
    return rows[0] ?? null;
}

export async function createGiveaway(channel, { title, keyword, minPermission = 0, winnerCount = 1, autoDraw = false, endsAt = null, pointCost = 0 }) {
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO giveaways (channel, title, keyword, min_permission, winner_count, auto_draw, ends_at, point_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`,
        [ch(channel), title, keyword.toLowerCase().trim(), minPermission, winnerCount, autoDraw, endsAt, Math.max(0, Number(pointCost) || 0)],
    );
    return rows[0];
}

export async function closeGiveaway(channel, id) {
    const { rows } = await pool.query(
        `UPDATE giveaways SET status = 'closed' WHERE channel = $1 AND id = $2 AND status = 'open' RETURNING *;`,
        [ch(channel), id],
    );
    const g = rows[0] ?? null;
    if (g) {
        // Verlaufs-Eintrag jetzt anlegen (Teilnehmerzahl steht endgültig fest, da nach "closed" keine neuen Teilnahmen mehr möglich sind).
        // Bleibt unabhängig vom giveaways-Eintrag erhalten, auch wenn dieser später gelöscht wird.
        const entryCount = await countEntries(id);
        await pool.query(
            `INSERT INTO giveaway_history (channel, giveaway_id, title, entry_count) VALUES ($1, $2, $3, $4)
             ON CONFLICT (giveaway_id) DO UPDATE SET entry_count = $4;`,
            [ch(channel), id, g.title, entryCount],
        );
    }
    return g;
}

export async function deleteGiveaway(channel, id) {
    const res = await pool.query(`DELETE FROM giveaways WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return res.rowCount > 0;
}

/** Prüft nur, ob das Stichwort zum offenen Giveaway passt (ohne einzutragen) – z. B. um vorher Punkte abzuziehen. */
export async function matchOpenGiveaway(channel, keyword) {
    const giveaway = await getOpenGiveaway(channel);
    if (!giveaway || giveaway.keyword !== keyword.toLowerCase()) return null;
    return giveaway;
}

export async function hasEntry(giveawayId, username) {
    const { rows } = await pool.query(`SELECT 1 FROM giveaway_entries WHERE giveaway_id = $1 AND username = $2;`, [
        giveawayId,
        username.toLowerCase(),
    ]);
    return rows.length > 0;
}

/** @returns {Promise<{giveaway, isNew: boolean}|null>} */
export async function addEntry(channel, keyword, username, displayName) {
    const giveaway = await getOpenGiveaway(channel);
    if (!giveaway || giveaway.keyword !== keyword.toLowerCase()) return null;
    const res = await pool.query(
        `INSERT INTO giveaway_entries (giveaway_id, username, display_name) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING;`,
        [giveaway.id, username.toLowerCase(), displayName],
    );
    return { giveaway, isNew: res.rowCount > 0 };
}

export async function listEntries(giveawayId) {
    const { rows } = await pool.query(
        `SELECT username, display_name FROM giveaway_entries WHERE giveaway_id = $1 ORDER BY created_at;`,
        [giveawayId],
    );
    return rows;
}

export async function countEntries(giveawayId) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM giveaway_entries WHERE giveaway_id = $1;`, [giveawayId]);
    return rows[0].n;
}

/** Zieht zufällige, eindeutige Gewinner aus den Teilnehmern und markiert das Giveaway als gezogen. */
export async function drawWinners(channel, id) {
    const giveaway = await getGiveaway(channel, id);
    if (!giveaway) return null;
    const entries = await listEntries(id);
    const pool_ = [...entries];
    const winners = [];
    while (pool_.length && winners.length < giveaway.winner_count) {
        const i = Math.floor(Math.random() * pool_.length);
        winners.push(pool_.splice(i, 1)[0]);
    }
    const names = winners.map((w) => w.display_name || w.username);
    await pool.query(`UPDATE giveaways SET status = 'drawn', ended_at = now(), winners = $2 WHERE id = $1;`, [id, names]);
    await pool.query(`UPDATE giveaway_history SET winners = $2 WHERE giveaway_id = $1;`, [id, names]);
    return { ...giveaway, status: "drawn", winners: names, entryCount: entries.length };
}

/** Verlauf: die letzten (standardmäßig 10) Giveaways – bleibt auch nach dem Löschen eines Giveaways erhalten. */
export async function giveawayHistory(channel, limit = 10) {
    const { rows } = await pool.query(
        `SELECT giveaway_id AS id, title, winners, entry_count FROM giveaway_history WHERE channel = $1 ORDER BY id DESC LIMIT $2;`,
        [ch(channel), limit],
    );
    return rows;
}
