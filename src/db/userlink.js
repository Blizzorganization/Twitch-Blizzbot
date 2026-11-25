import { pool } from "./pool.js";

/** Discord <-> Twitch-Verknüpfung (Tabelle userlink des alten Bots) */
export async function getTwitchName(discordId) {
    const { rows } = await pool.query(`SELECT twitchname FROM userlink WHERE discordid = $1;`, [discordId]);
    return rows[0]?.twitchname ?? null;
}

export async function linkUser(discordId, twitchName) {
    await pool.query(
        `INSERT INTO userlink (discordid, twitchname) VALUES ($1, $2)
         ON CONFLICT (discordid) DO UPDATE SET twitchname = EXCLUDED.twitchname;`,
        [discordId, twitchName.toLowerCase()],
    );
}

export async function unlinkUser(discordId) {
    const res = await pool.query(`DELETE FROM userlink WHERE discordid = $1;`, [discordId]);
    return res.rowCount > 0;
}

/** Discord-ID, die mit diesem Twitch-Namen verknüpft ist (oder null). */
export async function getDiscordId(twitchName) {
    const { rows } = await pool.query(`SELECT discordid FROM userlink WHERE twitchname = $1 LIMIT 1;`, [twitchName.toLowerCase()]);
    return rows[0]?.discordid ?? null;
}
