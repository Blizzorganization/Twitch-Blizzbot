import { pool } from "./pool.js";

/**
 * Schreibt einen Eintrag ins Audit-Log (für den Dashboard-Tab "Audit-Log", nur für Admins sichtbar).
 * @param {object} p
 * @param {string} p.actor       Benutzername des handelnden Dashboard-Nutzers (oder "admin-token")
 * @param {string} p.action      "create" | "edit" | "delete"
 * @param {string} p.targetType  "command" | "alias" | "counter" | "user"
 * @param {string} [p.target]    Name/Bezeichner des betroffenen Objekts (z. B. Befehlsname, Benutzername)
 * @param {string} [p.channel]   betroffener Twitch-Kanal (falls zutreffend)
 * @param {object} [p.details]   zusätzliche Infos (z. B. alte/neue Werte)
 */
export async function logAudit({ actor, action, targetType, target = null, channel = null, details = null }) {
    try {
        await pool.query(
            `INSERT INTO audit_log (actor, action, target_type, target, channel, details)
             VALUES ($1, $2, $3, $4, $5, $6);`,
            [actor, action, targetType, target, channel, details ? JSON.stringify(details) : null],
        );
    } catch (e) {
        // Das Audit-Log darf eine eigentliche Aktion nie verhindern - Fehler nur loggen.
        const { logger } = await import("../utils/logger.js");
        logger.error("Audit-Log konnte nicht geschrieben werden:", e);
    }
}

/**
 * Zählt Audit-Log-Einträge eines Kanals nach Objekt-Typ und Aktion (create/edit/delete/...), z. B.
 * { command: { create: 5, edit: 2, delete: 1 }, counter: { create: 3 } } - für den Verlauf-Unterreiter
 * im Dashboard-Tab "Statistiken".
 */
export async function getAuditStats(channel) {
    const { rows } = await pool.query(
        `SELECT target_type AS "targetType", action, COUNT(*)::int AS count
         FROM audit_log WHERE channel = $1
         GROUP BY target_type, action;`,
        [channel],
    );
    const result = {};
    for (const r of rows) {
        result[r.targetType] ??= {};
        result[r.targetType][r.action] = r.count;
    }
    return result;
}

/** Liefert eine Seite der Audit-Log-Einträge (neueste zuerst) + die Gesamtanzahl, zum Blättern im Dashboard. */
export async function listAuditLog(limit = 30, offset = 0, { q, action, type } = {}) {
    limit = Math.min(Math.max(Number(limit) || 30, 1), 1000);
    offset = Math.max(Number(offset) || 0, 0);
    // Optionale Filter: q = Suchtext in Wer/Ziel/Kanal, action = genaue Aktion, type = genauer Typ
    const where = [];
    const params = [];
    const text = String(q ?? "").trim().slice(0, 100);
    if (text) {
        params.push(`%${text.replace(/[\\%_]/g, "\\$&")}%`);
        where.push(`(actor ILIKE $${params.length} OR COALESCE(target, '') ILIKE $${params.length} OR COALESCE(channel, '') ILIKE $${params.length})`);
    }
    if (action) { params.push(String(action).slice(0, 32)); where.push(`action = $${params.length}`); }
    if (type) { params.push(String(type).slice(0, 20)); where.push(`target_type = $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { rows } = await pool.query(
        `SELECT id, actor, action, target_type AS "targetType", target, channel, details, created_at AS "createdAt"
         FROM audit_log ${clause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`,
        [...params, limit, offset],
    );
    const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_log ${clause};`, params);
    return { rows, total: countRows[0].total };
}

/** Löscht Audit-Log-Einträge, die älter als die angegebene Anzahl Tage sind (Standard: 3 Tage). */
export async function deleteOldAuditLog(days = 3) {
    const { rowCount } = await pool.query(`DELETE FROM audit_log WHERE created_at < now() - ($1 || ' days')::interval;`, [days]);
    return rowCount;
}
