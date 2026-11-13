import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;
const norm = (n) => String(n ?? "").trim().replace(/^@/, "").toLowerCase();

/** Zusätzliche Bot-Moderatoren je Kanal – synchron abfragbar (getPermission ist synchron), daher im Speicher gehalten. */
const cache = new Map(); // channel -> Set(username)
const onlyMode = new Set(); // Kanäle, in denen NUR die Liste als Moderator gilt

export const isBotMod = (channel, username) => cache.get(ch(channel))?.has(norm(username)) ?? false;
/** true, wenn im Dashboard "Nur Bot-Mods gelten als Moderator" aktiviert ist. */
export const botModsOnly = (channel) => onlyMode.has(ch(channel));

/** Lädt die komplette Tabelle neu in den Speicher (beim Start, nach Änderungen und regelmäßig). */
export async function refreshBotMods() {
    const { rows } = await pool.query(`SELECT channel, username FROM bot_mods;`);
    const next = new Map();
    for (const r of rows) {
        if (!next.has(r.channel)) next.set(r.channel, new Set());
        next.get(r.channel).add(r.username);
    }
    const flags = await pool.query(`SELECT channel FROM channel_settings WHERE bot_mods_only = TRUE;`);
    cache.clear();
    for (const [k, v] of next) cache.set(k, v);
    onlyMode.clear();
    for (const r of flags.rows) onlyMode.add(r.channel);
}

export async function listBotMods(channel) {
    const { rows } = await pool.query(`SELECT username, added_by, created_at FROM bot_mods WHERE channel = $1 ORDER BY username;`, [ch(channel)]);
    return rows;
}

/** @returns {Promise<{name:string, added:boolean}>} added=false, wenn der Nutzer schon eingetragen war */
export async function addBotMod(channel, username, addedBy) {
    await ensureChannel(channel);
    const name = norm(username);
    const { rowCount } = await pool.query(
        `INSERT INTO bot_mods (channel, username, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
        [ch(channel), name, addedBy ?? null],
    );
    await refreshBotMods();
    return { name, added: rowCount > 0 };
}

export async function removeBotMod(channel, username) {
    const { rowCount } = await pool.query(`DELETE FROM bot_mods WHERE channel = $1 AND username = $2;`, [ch(channel), norm(username)]);
    await refreshBotMods();
    return rowCount > 0;
}
