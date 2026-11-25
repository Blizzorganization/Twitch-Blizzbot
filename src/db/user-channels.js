import { pool } from "./pool.js";

/** Kanäle, auf die ein Benutzer eingeschränkt ist. Leeres Array = keine Einschränkung (alle Kanäle). */
export async function getUserChannels(userId) {
    const { rows } = await pool.query(`SELECT channel FROM user_channels WHERE user_id = $1 ORDER BY channel;`, [userId]);
    return rows.map((r) => r.channel);
}

/** Ersetzt die komplette Kanalliste eines Benutzers. Ein leeres Array hebt jede Einschränkung auf. */
export async function setUserChannels(userId, channels) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM user_channels WHERE user_id = $1;`, [userId]);
        for (const c of channels) {
            await client.query(
                `INSERT INTO user_channels (user_id, channel) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
                [userId, c.toLowerCase()],
            );
        }
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

/** true, wenn der Benutzer keine Einschränkung hat oder der Kanal explizit erlaubt ist. */
export async function userCanAccessChannel(userId, channel) {
    const channels = await getUserChannels(userId);
    return channels.length === 0 || channels.includes(channel.toLowerCase());
}
