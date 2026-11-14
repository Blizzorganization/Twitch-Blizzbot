import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

export async function listPredictions(channel) {
    const { rows } = await pool.query(`SELECT * FROM predictions WHERE channel = $1 ORDER BY id DESC;`, [ch(channel)]);
    return rows;
}

export async function getPrediction(channel, id) {
    const { rows } = await pool.query(`SELECT * FROM predictions WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return rows[0] ?? null;
}

export async function getActivePrediction(channel) {
    const { rows } = await pool.query(
        `SELECT * FROM predictions WHERE channel = $1 AND status IN ('active', 'locked') ORDER BY id DESC LIMIT 1;`,
        [ch(channel)],
    );
    return rows[0] ?? null;
}

export async function createPrediction(channel, { title, outcomes, durationSeconds, twitchPredictionId }) {
    await ensureChannel(channel);
    const locksAt = new Date(Date.now() + durationSeconds * 1000);
    const { rows } = await pool.query(
        `INSERT INTO predictions (channel, title, outcomes, locks_at, twitch_prediction_id) VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
        [ch(channel), title, JSON.stringify(outcomes), locksAt, twitchPredictionId],
    );
    return rows[0];
}

export async function setPredictionStatus(channel, id, status, { winningOutcome } = {}) {
    const { rows } = await pool.query(
        `UPDATE predictions SET
            status = $3,
            winning_outcome = COALESCE($4, winning_outcome),
            ended_at = CASE WHEN $3 IN ('resolved', 'canceled') THEN now() ELSE ended_at END
         WHERE channel = $1 AND id = $2 RETURNING *;`,
        [ch(channel), id, status, winningOutcome ?? null],
    );
    return rows[0] ?? null;
}

export async function deletePrediction(channel, id) {
    const res = await pool.query(`DELETE FROM predictions WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return res.rowCount > 0;
}
