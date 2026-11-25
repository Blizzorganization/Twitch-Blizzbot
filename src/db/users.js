import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const norm = (s) => String(s).trim().toLowerCase();

export const ROLES = ["owner", "admin", "member"];

const toPublic = (row) => ({
    ...row,
    // Abwärtskompatibel: isAdmin = true für owner UND admin (alte Frontend-/API-Checks "darf Nutzer verwalten")
    isAdmin: row.role === "owner" || row.role === "admin",
    isOwner: row.role === "owner",
    // Wird bei jeder Passwortänderung erhöht: ältere Anmelde-Tokens (mit kleinerer Version) werden dadurch ungültig
    tokenVersion: row.token_version ?? 0,
});

export async function countUsers() {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM web_users;`);
    return rows[0].n;
}

export async function listUsers() {
    const { rows } = await pool.query(`SELECT id, username, role, created_at FROM web_users ORDER BY username;`);
    const { rows: chRows } = await pool.query(`SELECT user_id, channel FROM user_channels;`);
    const byUser = new Map();
    for (const r of chRows) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
        byUser.get(r.user_id).push(r.channel);
    }
    // channels: [] bedeutet "keine Einschränkung" = Zugriff auf alle Kanäle
    return rows.map((u) => ({ ...toPublic(u), channels: byUser.get(u.id) ?? [] }));
}

export async function findByUsername(username) {
    const { rows } = await pool.query(
        `SELECT id, username, password_hash, role, token_version FROM web_users WHERE username = $1;`,
        [norm(username)],
    );
    return rows[0] ?? null;
}

export async function getUser(id) {
    const { rows } = await pool.query(`SELECT id, username, role, token_version FROM web_users WHERE id = $1;`, [id]);
    return rows[0] ? toPublic(rows[0]) : null;
}

/**
 * Legt einen neuen Dashboard-Nutzer an.
 * role: "owner" | "admin" | "member" (Standard: "member").
 * Die Vergabe-Regeln (nur Owner darf "admin" vergeben, Owner-Rolle kann nicht per Hand vergeben werden)
 * werden bewusst NICHT hier, sondern in dashboard/ anhand des anfragenden Nutzers geprüft.
 */
export async function createUser(username, password, role = "member") {
    if (!ROLES.includes(role)) role = "member";
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query(
        `INSERT INTO web_users (username, password_hash, role, is_admin) VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING RETURNING id, username, role, created_at;`,
        [norm(username), hash, role, role === "owner" || role === "admin"],
    );
    return res.rows[0] ? toPublic(res.rows[0]) : null; // null => Name schon vergeben
}

export async function updateUser(id, { username, password, role } = {}) {
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const newRole = role !== undefined && ROLES.includes(role) ? role : null;
    const res = await pool.query(
        `UPDATE web_users SET
            username = COALESCE($2, username),
            password_hash = COALESCE($3, password_hash),
            token_version = token_version + CASE WHEN $3::text IS NULL THEN 0 ELSE 1 END,
            role = COALESCE($4, role),
            is_admin = CASE WHEN $4::text IS NULL THEN is_admin ELSE ($4 = 'owner' OR $4 = 'admin') END
         WHERE id = $1 RETURNING id, username, role, token_version;`,
        [id, username ? norm(username) : null, hash, newRole],
    );
    return res.rows[0] ? toPublic(res.rows[0]) : null;
}

export async function deleteUser(id) {
    const res = await pool.query(`DELETE FROM web_users WHERE id = $1;`, [id]);
    return res.rowCount > 0;
}

export async function verifyPassword(username, password) {
    const user = await findByUsername(username);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password_hash);
    return ok ? toPublic({ id: user.id, username: user.username, role: user.role, token_version: user.token_version }) : null;
}

/** true, wenn userId aktuell Haupt-Admin (owner) ist UND es keinen weiteren Owner gibt (Schutz vor Aussperrung). */
export async function isLastOwner(userId) {
    const { rows } = await pool.query(`SELECT role FROM web_users WHERE id = $1;`, [userId]);
    if (rows[0]?.role !== "owner") return false;
    const { rows: others } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM web_users WHERE role = 'owner' AND id <> $1;`,
        [userId],
    );
    return others[0].n === 0;
}

/** Abwärtskompatibler Alias, falls noch irgendwo isLastAdmin importiert wird. */
export const isLastAdmin = isLastOwner;
