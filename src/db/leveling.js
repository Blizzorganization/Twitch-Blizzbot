import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { getChannelSettings, DEFAULT_LEVEL_XP_BASE, DEFAULT_LEVEL_XP_MULTIPLIER } from "./channel-settings.js";

const ch = cleanChannel;

/**
 * XP-Kurve (je Kanal im Dashboard einstellbar): Level 1 kostet `base` XP, jedes weitere Level `multiplier`-mal so viel
 * wie das vorherige. xpForLevel(n) = XP-GESAMT, die für Level n nötig sind: base * (m^n - 1) / (m - 1).
 * @typedef {{ base: number, multiplier: number }} Curve
 */
export async function getCurve(channel) {
    const s = await getChannelSettings(channel);
    const base = Number(s.levelXpBase) > 0 ? Number(s.levelXpBase) : DEFAULT_LEVEL_XP_BASE;
    const multiplier = Number(s.levelXpMultiplier) >= 1 ? Number(s.levelXpMultiplier) : DEFAULT_LEVEL_XP_MULTIPLIER;
    return { base, multiplier };
}

export function xpForLevel(level, curve) {
    if (level <= 0) return 0;
    const { base, multiplier: m } = curve;
    return Math.round(m === 1 ? base * level : (base * (Math.pow(m, level) - 1)) / (m - 1));
}

export function levelFromXp(xp, curve) {
    xp = Math.max(0, Number(xp) || 0);
    const { base, multiplier: m } = curve;
    let level = m === 1 ? Math.floor(xp / base) : Math.floor(Math.log(1 + (xp * (m - 1)) / base) / Math.log(m));
    // Gleitkomma-Ungenauigkeiten korrigieren, damit xpForLevel(level) <= xp < xpForLevel(level + 1) exakt gilt
    while (xpForLevel(level + 1, curve) <= xp) level++;
    while (level > 0 && xpForLevel(level, curve) > xp) level--;
    return level;
}

/** Level + Fortschritt zum nächsten Level, für Anzeige im Chat/Dashboard. */
export function levelProgress(xp, curve) {
    const level = levelFromXp(xp, curve);
    const xpInLevel = xp - xpForLevel(level, curve);
    const xpToNext = xpForLevel(level + 1, curve) - xpForLevel(level, curve);
    return { level, xp, xpInLevel, xpToNext };
}

/**
 * Vergibt XP für eine Chatnachricht, aber nur, wenn der Cooldown (Sekunden) seit der letzten
 * XP-Nachricht dieses Nutzers abgelaufen ist (Schutz gegen Spam-Farming).
 * @returns {Promise<{xp: number, leveledUp: boolean, level: number} | null>} null = Cooldown aktiv
 */
export async function grantMessageXp(channel, username, displayName, amount, cooldownSeconds) {
    channel = ch(channel);
    username = username.toLowerCase();
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO user_leveling (channel, username, display_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
        [channel, username, displayName],
    );
    const { rows } = await pool.query(
        `UPDATE user_leveling SET xp = xp + $3, display_name = $4, last_message_xp_at = now()
         WHERE channel = $1 AND username = $2
           AND (last_message_xp_at IS NULL OR last_message_xp_at <= now() - ($5 || ' seconds')::interval)
         RETURNING xp, xp - $3 AS old_xp;`,
        [channel, username, amount, displayName, cooldownSeconds],
    );
    if (!rows[0]) return null; // Cooldown aktiv
    const { xp, old_xp } = rows[0];
    const curve = await getCurve(channel);
    return { xp, level: levelFromXp(xp, curve), leveledUp: levelFromXp(xp, curve) > levelFromXp(old_xp, curve) };
}

/**
 * Vergibt Punkte für eine Chatnachricht, aber nur, wenn der Cooldown (Sekunden) seit der letzten Punkte-Nachricht
 * dieses Nutzers abgelaufen ist (Schutz gegen Spam-Farming). Eigener Cooldown, unabhängig vom XP-Cooldown.
 * @returns {Promise<number | null>} neuer Punktestand, null = Cooldown aktiv
 */
export async function grantMessagePoints(channel, username, displayName, amount, cooldownSeconds) {
    channel = ch(channel);
    username = username.toLowerCase();
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO user_leveling (channel, username, display_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
        [channel, username, displayName],
    );
    const { rows } = await pool.query(
        `UPDATE user_leveling SET points = points + $3, display_name = $4, last_message_points_at = now()
         WHERE channel = $1 AND username = $2
           AND (last_message_points_at IS NULL OR last_message_points_at <= now() - ($5 || ' seconds')::interval)
         RETURNING points;`,
        [channel, username, amount, displayName, cooldownSeconds],
    );
    return rows[0] ? Number(rows[0].points) : null;
}

/**
 * Vergibt (passiv) XP und/oder Punkte für Watchtime an mehrere Nutzer gleichzeitig (ein Tick der
 * Watchtime-Erfassung). Beide Beträge können 0 sein, wenn das jeweilige System im Kanal aus ist.
 * @returns {Promise<Array<{username, display_name, xp, old_xp}>>}
 */
export async function grantWatchLeveling(channel, usernames, xpAmount, pointsAmount) {
    channel = ch(channel);
    if (!usernames.length || (!xpAmount && !pointsAmount)) return [];
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO user_leveling (channel, username, display_name)
         SELECT $1, v, v FROM unnest($2::varchar(25)[]) AS v ON CONFLICT DO NOTHING;`,
        [channel, usernames],
    );
    const { rows } = await pool.query(
        `UPDATE user_leveling SET xp = xp + $3, points = GREATEST(0, points + $4)
         WHERE channel = $1 AND username = ANY($2::varchar(25)[])
         RETURNING username, display_name, xp, xp - $3 AS old_xp;`,
        [channel, usernames, xpAmount, pointsAmount],
    );
    return rows;
}

/** Setzt XP (und damit das Level) ALLER Nutzer des Kanals auf 0 zurück. Punkte bleiben unverändert. */
export async function resetXp(channel) {
    const { rowCount } = await pool.query(
        `UPDATE user_leveling SET xp = 0, last_message_xp_at = NULL, updated_at = now() WHERE channel = $1 AND xp <> 0;`,
        [ch(channel)],
    );
    await pruneEmptyUsers(channel);
    return rowCount;
}

/** Löscht Einträge, die weder XP noch Punkte haben (nach Zurücksetzen/Entziehen soll keine leere Zeile übrig bleiben). */
export async function pruneEmptyUsers(channel, username) {
    const { rowCount } = await pool.query(
        `DELETE FROM user_leveling WHERE channel = $1 AND xp = 0 AND points = 0 AND ($2::text IS NULL OR username = $2);`,
        [ch(channel), username ? username.toLowerCase() : null],
    );
    return rowCount;
}

/** Setzt die Punkte ALLER Nutzer des Kanals auf 0 zurück. XP und Level bleiben unverändert. */
export async function resetPoints(channel) {
    const { rowCount } = await pool.query(
        `UPDATE user_leveling SET points = 0, updated_at = now() WHERE channel = $1 AND points <> 0;`,
        [ch(channel)],
    );
    await pruneEmptyUsers(channel);
    return rowCount;
}

/** Punkte addieren (auch negativ zum Abziehen) – für Mod-Vergabe. Fällt nie unter 0. */
export async function grantPoints(channel, username, displayName, amount) {
    channel = ch(channel);
    username = username.toLowerCase();
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO user_leveling (channel, username, display_name, points) VALUES ($1, $2, $3, GREATEST(0, $4))
         ON CONFLICT (channel, username) DO UPDATE SET
            points = GREATEST(0, user_leveling.points + $4), display_name = $3, updated_at = now()
         RETURNING points;`,
        [channel, username, displayName, amount],
    );
    await pruneEmptyUsers(channel, username);
    return rows[0].points;
}

/** XP addieren (auch negativ zum Abziehen) – für die manuelle Vergabe im Dashboard. Fällt nie unter 0. Ändert nur XP/Level, keine Level-Up-Meldung. */
export async function grantXp(channel, username, displayName, amount) {
    channel = ch(channel);
    username = username.toLowerCase();
    await ensureChannel(channel);
    const { rows } = await pool.query(
        `INSERT INTO user_leveling (channel, username, display_name, xp) VALUES ($1, $2, $3, GREATEST(0, $4))
         ON CONFLICT (channel, username) DO UPDATE SET
            xp = GREATEST(0, user_leveling.xp + $4), display_name = $3, updated_at = now()
         RETURNING xp;`,
        [channel, username, displayName, amount],
    );
    const xp = Number(rows[0].xp);
    await pruneEmptyUsers(channel, username); // neu angelegt und gleich wieder 0: keinen leeren Eintrag behalten
    return { xp, level: levelFromXp(xp, await getCurve(channel)) };
}

/** Zieht Punkte atomar ab, aber NUR wenn genug vorhanden sind (z. B. Giveaway-Teilnahme-Einsatz). */
export async function trySpendPoints(channel, username, cost) {
    if (!cost) return true; // kostenlos
    channel = ch(channel);
    username = username.toLowerCase();
    const { rows } = await pool.query(
        `UPDATE user_leveling SET points = points - $3 WHERE channel = $1 AND username = $2 AND points >= $3 RETURNING points;`,
        [channel, username, cost],
    );
    return !!rows[0];
}

export async function getUserStats(channel, username) {
    const { rows } = await pool.query(`SELECT xp, points FROM user_leveling WHERE channel = $1 AND username = $2;`, [
        ch(channel),
        username.toLowerCase(),
    ]);
    const xp = rows[0]?.xp ?? 0;
    const points = rows[0]?.points ?? 0;
    return { ...levelProgress(Number(xp), await getCurve(channel)), points: Number(points) };
}

export async function topXp(channel, limit = 10) {
    const { rows } = await pool.query(
        `SELECT username, display_name, xp FROM user_leveling WHERE channel = $1 ORDER BY xp DESC LIMIT $2;`,
        [ch(channel), limit],
    );
    const curve = await getCurve(channel);
    return rows.map((r) => ({ username: r.username, displayName: r.display_name, ...levelProgress(Number(r.xp), curve) }));
}

export async function topPoints(channel, limit = 10) {
    const { rows } = await pool.query(
        `SELECT username, display_name, points FROM user_leveling WHERE channel = $1 ORDER BY points DESC LIMIT $2;`,
        [ch(channel), limit],
    );
    return rows.map((r) => ({ username: r.username, displayName: r.display_name, points: Number(r.points) }));
}

/** Platz im XP- und Punkte-Ranking (1 = ganz vorn) oder null, wenn der Nutzer dort noch nicht vorkommt. */
export async function getUserRanks(channel, username) {
    const { rows } = await pool.query(
        `SELECT
            CASE WHEN me.username IS NULL THEN NULL ELSE (SELECT COUNT(*) + 1 FROM user_leveling o WHERE o.channel = $1 AND o.xp > me.xp) END AS xp_rank,
            CASE WHEN me.username IS NULL THEN NULL ELSE (SELECT COUNT(*) + 1 FROM user_leveling o WHERE o.channel = $1 AND o.points > me.points) END AS points_rank
         FROM (SELECT $1::text AS c) x
         LEFT JOIN user_leveling me ON me.channel = $1 AND me.username = $2;`,
        [ch(channel), username.toLowerCase()],
    );
    return {
        xpRank: rows[0]?.xp_rank == null ? null : Number(rows[0].xp_rank),
        pointsRank: rows[0]?.points_rank == null ? null : Number(rows[0].points_rank),
    };
}
