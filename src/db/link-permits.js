import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

/** Legt eine Freigabe an oder verlängert/ersetzt die bestehende. */
export async function grantLinkPermit(channel, username, expiresAt, untilOffline, grantedBy) {
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO link_permits (channel, username, expires_at, until_offline, granted_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (channel, username) DO UPDATE
         SET expires_at = EXCLUDED.expires_at, until_offline = EXCLUDED.until_offline, granted_by = EXCLUDED.granted_by
         RETURNING channel, username, expires_at, until_offline, granted_by;`,
        [ch(channel), String(username).toLowerCase(), expiresAt, !!untilOffline, grantedBy ?? null],
    );
    return rows[0];
}

/** Die gültige (zeitlich nicht abgelaufene) Freigabe eines Nutzers oder null. Abgelaufene Einträge werden dabei aufgeräumt. */
export async function getLinkPermit(channel, username) {
    await pool.query(`DELETE FROM link_permits WHERE expires_at <= now();`);
    const { rows } = await pool.query(
        `SELECT channel, username, expires_at, until_offline, granted_by FROM link_permits WHERE channel = $1 AND username = $2;`,
        [ch(channel), String(username).toLowerCase()],
    );
    return rows[0] ?? null;
}

export async function listLinkPermits(channel) {
    await pool.query(`DELETE FROM link_permits WHERE expires_at <= now();`);
    const { rows } = await pool.query(
        `SELECT username, expires_at, until_offline, granted_by FROM link_permits WHERE channel = $1 ORDER BY expires_at, username;`,
        [ch(channel)],
    );
    return rows;
}

/** Löscht alle "bis Stream-Ende"-Freigaben eines Kanals (der Kanal ist offline gegangen). */
export async function endStreamPermits(channel) {
    await pool.query(`DELETE FROM link_permits WHERE channel = $1 AND until_offline;`, [ch(channel)]);
}

/** @returns {Promise<boolean>} true, wenn es eine Freigabe gab */
export async function revokeLinkPermit(channel, username) {
    const { rowCount } = await pool.query(`DELETE FROM link_permits WHERE channel = $1 AND username = $2;`, [ch(channel), String(username).toLowerCase()]);
    return rowCount > 0;
}
