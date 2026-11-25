import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { logger } from "../utils/logger.js";

/** Schreibt ein Event ins Log (Fehler brechen den Bot nie ab). */
export async function logEvent(channel, eventType, username = null, data = {}) {
    channel = cleanChannel(channel);
    try {
        await pool.query(
            `INSERT INTO event_log (channel, event_type, username, data) VALUES ($1, $2, $3, $4);`,
            [channel, eventType, username, JSON.stringify(data)],
        );
    } catch (e) {
        logger.error("logEvent fehlgeschlagen:", e.message);
    }
}

/** Erhöht die Community-Sub-Gesamtzahl und gibt den neuen Stand zurück. */
export async function addSubs(channel, amount = 1) {
    channel = cleanChannel(channel);
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `UPDATE streamer SET total_subs = total_subs + $2 WHERE name = $1 RETURNING total_subs;`,
        [channel, amount],
    );
    return rows[0].total_subs;
}

export async function getTotalSubs(channel) {
    channel = cleanChannel(channel);
    const { rows } = await pool.query(`SELECT total_subs FROM streamer WHERE name = $1;`, [channel]);
    return rows[0]?.total_subs ?? 0;
}

export async function setTotalSubs(channel, value) {
    channel = cleanChannel(channel);
    await ensureChannel(channel);
    await pool.query(`UPDATE streamer SET total_subs = $2 WHERE name = $1;`, [channel, value]);
}

/** Aggregierte Statistiken für das Web-Interface. */
export async function getStats(channel) {
    channel = cleanChannel(channel);
    const counts = await pool.query(
        `SELECT event_type, COUNT(*)::int AS count
         FROM event_log WHERE channel = $1 GROUP BY event_type;`,
        [channel],
    );
    const topCommands = await pool.query(
        `SELECT data->>'command' AS command, COUNT(*)::int AS count
         FROM event_log WHERE channel = $1 AND event_type = 'command'
         GROUP BY 1 ORDER BY count DESC LIMIT 10;`,
        [channel],
    );
    const bits = await pool.query(
        `SELECT COALESCE(SUM((data->>'bits')::int), 0)::int AS total
         FROM event_log WHERE channel = $1 AND event_type = 'alert_bits';`,
        [channel],
    );
    const raidViewers = await pool.query(
        `SELECT COALESCE(SUM((data->>'viewers')::int), 0)::int AS total
         FROM event_log WHERE channel = $1 AND event_type = 'alert_raid';`,
        [channel],
    );
    const perDay = await pool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM event_log WHERE channel = $1 AND event_type = 'command' AND created_at > now() - interval '14 days'
         GROUP BY 1 ORDER BY 1;`,
        [channel],
    );
    const recent = await pool.query(
        `SELECT event_type, username, data, created_at
         FROM event_log WHERE channel = $1 AND event_type LIKE 'alert_%'
         ORDER BY created_at DESC LIMIT 20;`,
        [channel],
    );
    return {
        totalSubs: await getTotalSubs(channel),
        eventCounts: Object.fromEntries(counts.rows.map((r) => [r.event_type, r.count])),
        topCommands: topCommands.rows,
        totalBits: bits.rows[0].total,
        totalRaidViewers: raidViewers.rows[0].total,
        commandsPerDay: perDay.rows,
        recentAlerts: recent.rows,
    };
}

/**
 * Moderationsaktionen (automatische Blacklist-/Link-/-me-Filter-Treffer) aus dem event_log, gruppiert
 * nach Art der Aktion (0 = Nachricht gelöscht, 1-9 = Timeout, 10 = Bann) - für den Verlauf-Unterreiter
 * im Dashboard-Tab "Statistiken". Dazu die häufigsten Auslöser (Blacklist-Wort/"link"/"action").
 */
export async function getModActionStats(channel) {
    channel = cleanChannel(channel);
    const totals = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE (data->>'action')::int = 0)::int AS deleted,
            COUNT(*) FILTER (WHERE (data->>'action')::int BETWEEN 1 AND 9)::int AS timeouts,
            COUNT(*) FILTER (WHERE (data->>'action')::int = 10)::int AS bans
         FROM event_log WHERE channel = $1 AND event_type = 'blacklist_hit';`,
        [channel],
    );
    const topTriggers = await pool.query(
        `SELECT data->>'word' AS trigger, COUNT(*)::int AS count
         FROM event_log WHERE channel = $1 AND event_type = 'blacklist_hit'
         GROUP BY 1 ORDER BY count DESC LIMIT 10;`,
        [channel],
    );
    return { ...totals.rows[0], topTriggers: topTriggers.rows };
}

/**
 * Aktionen von menschlichen Moderatoren (Event "mod_action", siehe twitch/modlog.js): Gesamtzahlen
 * (Nachricht gelöscht / Timeout / Bann) und pro Moderator.
 */
export async function getModeratorActionStats(channel) {
    channel = cleanChannel(channel);
    const perMod = await pool.query(
        `SELECT username AS moderator,
                COUNT(*) FILTER (WHERE data->>'action' = 'delete')::int AS deleted,
                COUNT(*) FILTER (WHERE data->>'action' = 'timeout')::int AS timeouts,
                COUNT(*) FILTER (WHERE data->>'action' = 'ban')::int AS bans
         FROM event_log WHERE channel = $1 AND event_type = 'mod_action'
         GROUP BY username ORDER BY COUNT(*) DESC, username LIMIT 50;`,
        [channel],
    );
    const sum = (key) => perMod.rows.reduce((n, r) => n + r[key], 0);
    const reset = await pool.query(
        `SELECT reset_at, date_trunc('month', reset_at) = date_trunc('month', now()) AS this_month
         FROM mod_action_resets WHERE channel = $1;`,
        [channel],
    );
    const lastReset = reset.rows[0]?.reset_at ?? null;
    return {
        deleted: sum("deleted"),
        timeouts: sum("timeouts"),
        bans: sum("bans"),
        perModerator: perMod.rows,
        lastReset,
        canReset: !reset.rows[0]?.this_month, // höchstens einmal pro Kalendermonat
    };
}

/**
 * Leert die Moderator-Statistik (alle "mod_action"-Einträge des Kanals). Nur einmal pro Kalendermonat erlaubt.
 * @returns {Promise<{ok: boolean, removed?: number}>} ok=false, wenn in diesem Monat schon geleert wurde
 */
export async function resetModeratorActionStats(channel) {
    channel = cleanChannel(channel);
    await ensureChannel(channel);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const check = await client.query(
            `SELECT date_trunc('month', reset_at) = date_trunc('month', now()) AS this_month
             FROM mod_action_resets WHERE channel = $1 FOR UPDATE;`,
            [channel],
        );
        if (check.rows[0]?.this_month) {
            await client.query("ROLLBACK");
            return { ok: false };
        }
        const del = await client.query(`DELETE FROM event_log WHERE channel = $1 AND event_type = 'mod_action';`, [channel]);
        await client.query(
            `INSERT INTO mod_action_resets (channel, reset_at) VALUES ($1, now())
             ON CONFLICT (channel) DO UPDATE SET reset_at = now();`,
            [channel],
        );
        await client.query("COMMIT");
        return { ok: true, removed: del.rowCount };
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}
