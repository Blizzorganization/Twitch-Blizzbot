import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

/**
 * Altes Schema: blacklist(channel, blword, action)
 * action: 0 = Nachricht löschen, 1-9 = Timeout (10s, 30s, 42s, 1m, 5m, 10m, 20m, 30m, 1h), 10 = Bann
 */
export async function listBlacklist(channel) {
    const { rows } = await pool.query(
        `SELECT blword AS word, action FROM blacklist WHERE channel = $1 ORDER BY action, blword;`,
        [ch(channel)],
    );
    return rows;
}

export async function addBlacklist(channel, word, action = 0) {
    if (!Number.isInteger(action) || action < 0 || action > 10) throw new Error("Aktion muss 0-10 sein");
    await ensureChannel(channel);
    const res = await pool.query(
        `INSERT INTO blacklist (channel, blword, action) VALUES ($1, $2, $3)
         ON CONFLICT (channel, blword) DO NOTHING RETURNING blword;`,
        [ch(channel), word.trim().toLowerCase(), action],
    );
    return res.rowCount > 0;
}

export async function updateBlacklist(channel, word, action) {
    const res = await pool.query(`UPDATE blacklist SET action = $3 WHERE channel = $1 AND blword = $2;`, [
        ch(channel),
        word.trim().toLowerCase(),
        action,
    ]);
    return res.rowCount > 0;
}

export async function deleteBlacklist(channel, word) {
    const res = await pool.query(`DELETE FROM blacklist WHERE channel = $1 AND blword = $2;`, [
        ch(channel),
        word.trim().toLowerCase(),
    ]);
    return res.rowCount > 0;
}

/* Kleiner In-Memory-Cache, damit nicht jede Chatnachricht die DB trifft */
const cache = new Map(); // channel -> { at, entries }
const TTL_MS = 30_000;

export function invalidateBlacklistCache(channel) {
    if (channel) cache.delete(ch(channel));
    else cache.clear();
}

/**
 * Wie im alten Bot: Treffer, wenn " wort " in " nachricht " vorkommt (ganze Wörter).
 * Bei mehreren Treffern gewinnt die höchste Aktion.
 * @returns {{word: string, action: number} | null}
 */
export async function findBlacklistHit(channel, text) {
    const c = ch(channel);
    let hit = cache.get(c);
    if (!hit || Date.now() - hit.at > TTL_MS) {
        hit = { at: Date.now(), entries: await listBlacklist(c) };
        cache.set(c, hit);
    }
    const padded = ` ${text.toLowerCase()} `;
    const matches = hit.entries.filter((e) => padded.includes(` ${e.word} `));
    if (!matches.length) return null;
    return matches.reduce((a, b) => (b.action > a.action ? b : a));
}
