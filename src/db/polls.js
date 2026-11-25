import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

const ch = cleanChannel;

export async function listPolls(channel, { status } = {}) {
    const { rows } = await pool.query(
        `SELECT * FROM polls WHERE channel = $1 AND ($2::text IS NULL OR status = $2) ORDER BY id DESC;`,
        [ch(channel), status ?? null],
    );
    return rows;
}

export async function getPoll(channel, id) {
    const { rows } = await pool.query(`SELECT * FROM polls WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return rows[0] ?? null;
}

export async function getActivePoll(channel) {
    const { rows } = await pool.query(`SELECT * FROM polls WHERE channel = $1 AND status = 'active' ORDER BY id DESC LIMIT 1;`, [
        ch(channel),
    ]);
    return rows[0] ?? null;
}

export async function createPoll(channel, { title, options, mode = "chat", durationSeconds = 60, twitchPollId = null }) {
    await ensureChannel(channel);
    const endsAt = new Date(Date.now() + durationSeconds * 1000);
    const { rows } = await pool.query(
        `INSERT INTO polls (channel, title, options, mode, ends_at, twitch_poll_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
        [ch(channel), title, JSON.stringify(options), mode, endsAt, twitchPollId],
    );
    return rows[0];
}

/** Stimme abgeben (chat-Modus); eine Stimme pro Nutzer, letzte zählt. @returns {boolean} ob die Wahl gültig war */
export async function vote(pollId, username, choice, optionCount) {
    if (!Number.isInteger(choice) || choice < 1 || choice > optionCount) return false;
    await pool.query(
        `INSERT INTO poll_votes (poll_id, username, choice) VALUES ($1, $2, $3)
         ON CONFLICT (poll_id, username) DO UPDATE SET choice = EXCLUDED.choice, created_at = now();`,
        [pollId, username.toLowerCase(), choice],
    );
    return true;
}

export async function tally(pollId, optionCount) {
    const { rows } = await pool.query(`SELECT choice, COUNT(*)::int AS n FROM poll_votes WHERE poll_id = $1 GROUP BY choice;`, [
        pollId,
    ]);
    const counts = Array(optionCount).fill(0);
    for (const r of rows) if (r.choice >= 1 && r.choice <= optionCount) counts[r.choice - 1] = r.n;
    return counts;
}

export async function endPoll(channel, id, result) {
    const { rows } = await pool.query(
        `UPDATE polls SET status = 'ended', ended_at = now(), result = $3 WHERE channel = $1 AND id = $2 RETURNING *;`,
        [ch(channel), id, JSON.stringify(result)],
    );
    return rows[0] ?? null;
}

export async function deletePoll(channel, id) {
    const res = await pool.query(`DELETE FROM polls WHERE channel = $1 AND id = $2;`, [ch(channel), id]);
    return res.rowCount > 0;
}
