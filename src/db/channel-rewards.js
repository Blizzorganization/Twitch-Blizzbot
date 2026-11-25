import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

/* --------------------------- Rewards (vom Bot angelegt) --------------------------- */

export async function listChannelRewards(channel) {
    const { rows } = await pool.query(`SELECT * FROM channel_rewards WHERE channel = $1 ORDER BY id DESC;`, [ch(channel)]);
    return rows;
}

export async function getChannelReward(channel, id) {
    const { rows } = await pool.query(`SELECT * FROM channel_rewards WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return rows[0] ?? null;
}

export async function createChannelRewardRow(channel, { twitchRewardId, title, cost, prompt, userInputRequired }) {
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO channel_rewards (channel, twitch_reward_id, title, cost, prompt, user_input_required)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
        [ch(channel), twitchRewardId, title, cost, prompt ?? null, !!userInputRequired],
    );
    return rows[0];
}

export async function deleteChannelRewardRow(channel, id) {
    const res = await pool.query(`DELETE FROM channel_rewards WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return res.rowCount > 0;
}

/* ------------------------------- Einlösungen (Protokoll) ------------------------------- */
/* Erfasst ALLE Rewards eines Kanals per EventSub (siehe src/twitch/eventsub.js), nicht nur vom Bot
   selbst angelegte - Titel/Kosten kommen deshalb direkt aus dem Event statt über eine lokale
   Fremdschlüssel-Beziehung auf channel_rewards. */

export async function listRedemptions(channel, { limit = 200 } = {}) {
    const { rows } = await pool.query(
        `SELECT id, user_name, user_input, redeemed_at, reward_title, reward_cost, fulfilled
         FROM channel_reward_redemptions
         WHERE channel = $1
         ORDER BY redeemed_at DESC
         LIMIT $2;`,
        [ch(channel), limit],
    );
    return rows;
}

/** Trägt eine Einlösung ein; gibt false zurück, wenn sie (per twitch_redemption_id) schon bekannt ist. */
export async function addRedemption(channel, { twitchRewardId, rewardTitle, rewardCost, twitchRedemptionId, userName, userInput, redeemedAt }) {
    await ensureChannel(channel);
    const res = await pool.query(
        `INSERT INTO channel_reward_redemptions
            (channel, twitch_reward_id, reward_title, reward_cost, twitch_redemption_id, user_name, user_input, redeemed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (twitch_redemption_id) DO NOTHING RETURNING id;`,
        [ch(channel), twitchRewardId, rewardTitle, rewardCost, twitchRedemptionId, userName, userInput ?? null, redeemedAt],
    );
    return res.rowCount > 0;
}

/** Markiert eine Einlösung als bei Twitch erledigt (nur möglich für vom Bot selbst angelegte Rewards). */
export async function markRedemptionFulfilled(channel, twitchRedemptionId) {
    await pool.query(
        `UPDATE channel_reward_redemptions SET fulfilled = true WHERE channel = $1 AND twitch_redemption_id = $2;`,
        [ch(channel), twitchRedemptionId],
    );
}
