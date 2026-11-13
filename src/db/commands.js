import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { config } from "../config.js";

/**
 * Wie im alten Blizzbot werden Commands und Aliase MIT führendem "!" gespeichert.
 * Nach außen (Bot, Discord, Web) geben alle Funktionen die Namen OHNE "!" zurück.
 */
const store = (s) => "!" + String(s).trim().toLowerCase().replace(/^!+/, "");
const ch = cleanChannel;

const CMD_COLS = `regexp_replace(command, '^!', '') AS command, response, permissions AS permission,
                  cooldown, uses, enabled`;

/* ------------------------------ Commands ------------------------------ */

export async function listCommands(channel) {
    const { rows } = await pool.query(
        `SELECT ${CMD_COLS} FROM customcommands WHERE channel = $1 ORDER BY command;`,
        [ch(channel)],
    );
    return rows;
}

/** Namen (MIT "!") aller Custom Commands einer exakten Rechtestufe – wie allCcmds im alten Bot. */
export async function listCommandNames(channel, permission = 0) {
    const { rows } = await pool.query(
        `SELECT command FROM customcommands WHERE channel = $1 AND COALESCE(permissions, 0) = $2 AND enabled IS NOT FALSE ORDER BY command;`,
        [ch(channel), permission],
    );
    return rows.map((r) => r.command);
}

/** Ein Custom Command exakt (ohne Alias-Auflösung) – wie getCcmd im alten Bot. */
export async function getCommand(channel, name) {
    const { rows } = await pool.query(`SELECT ${CMD_COLS} FROM customcommands WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(name),
    ]);
    return rows[0] ?? null;
}

/** Löst einen Alias auf ({alias, command} MIT "!") – wie resolveAlias im alten Bot. */
export async function getAlias(channel, name) {
    const { rows } = await pool.query(`SELECT alias, command FROM aliases WHERE channel = $1 AND alias = $2;`, [
        ch(channel),
        store(name),
    ]);
    return rows[0] ?? null;
}

/** Benennt einen Command um (Aliase folgen per ON UPDATE CASCADE). */
export async function renameCommand(channel, oldName, newName) {
    const res = await pool.query(`UPDATE customcommands SET command = $3 WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(oldName),
        store(newName),
    ]);
    return res.rowCount > 0;
}

/** Wechselt Nutzer- <-> Mod-Command wie transferCmd im alten Bot. @returns {"ok"|"no_such_command"} */
export async function transferCommand(channel, name, userPerm = 0, modPerm = 3) {
    const cmd = await pool.query(`SELECT permissions FROM customcommands WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(name),
    ]);
    if (cmd.rowCount === 0) return "no_such_command";
    const next = (cmd.rows[0].permissions ?? 0) === userPerm ? modPerm : userPerm;
    await pool.query(`UPDATE customcommands SET permissions = $3 WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(name),
        next,
    ]);
    return "ok";
}

/* ---- Tabelle "commands": eingebaute Commands ein-/ausschalten (!switch) ---- */

export async function getInternalState(channel, name) {
    const { rows } = await pool.query(`SELECT enabled, permission FROM commands WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        String(name).toLowerCase().replace(/^!/, ""),
    ]);
    return rows[0] ?? null;
}

/** Alle abweichenden Zustände (an/aus, eigene Rechte) eingebauter Commands für einen Kanal - für das Dashboard. */
export async function listInternalStates(channel) {
    const { rows } = await pool.query(`SELECT command, enabled, permission FROM commands WHERE channel = $1;`, [ch(channel)]);
    return rows;
}

export async function setInternalEnabled(channel, name, enabled) {
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO commands (channel, command, enabled, permission) VALUES ($1, $2, $3, -1)
         ON CONFLICT (channel, command) DO UPDATE SET enabled = EXCLUDED.enabled;`,
        [ch(channel), String(name).toLowerCase().replace(/^!/, ""), enabled],
    );
}

export async function addCommand(channel, command, response, { permission = 0, cooldown = config.bot.defaultCooldown } = {}) {
    await ensureChannel(channel);
    // Existiert schon ein Alias mit diesem Namen? (wie im alten !add)
    const alias = await pool.query(`SELECT 1 FROM aliases WHERE channel = $1 AND alias = $2;`, [ch(channel), store(command)]);
    if (alias.rowCount > 0) return false;
    const res = await pool.query(
        `INSERT INTO customcommands (channel, command, response, permissions, cooldown)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (channel, command) DO NOTHING RETURNING command;`,
        [ch(channel), store(command), response, permission, cooldown],
    );
    return res.rowCount > 0; // false => existiert schon
}

export async function editCommand(channel, command, response, { permission, cooldown } = {}) {
    const res = await pool.query(
        `UPDATE customcommands SET
            response = COALESCE($3, response),
            permissions = COALESCE($4, permissions),
            cooldown = COALESCE($5, cooldown)
         WHERE channel = $1 AND command = $2 RETURNING command;`,
        [ch(channel), store(command), response ?? null, permission ?? null, cooldown ?? null],
    );
    return res.rowCount > 0;
}

/** Schaltet einen einzelnen Custom Command ein/aus. */
export async function setCommandEnabled(channel, command, enabled) {
    const res = await pool.query(
        `UPDATE customcommands SET enabled = $3 WHERE channel = $1 AND command = $2 RETURNING command;`,
        [ch(channel), store(command), !!enabled],
    );
    return res.rowCount > 0;
}

/** Schaltet ALLE Custom Commands eines Kanals auf einmal ein/aus (Dashboard-Bulk-Aktion). @returns Anzahl betroffener Commands */
export async function setAllCommandsEnabled(channel, enabled) {
    const res = await pool.query(`UPDATE customcommands SET enabled = $2 WHERE channel = $1;`, [ch(channel), !!enabled]);
    return res.rowCount;
}

export async function deleteCommand(channel, command) {
    // Aliase werden per ON DELETE CASCADE (altes Schema) mitgelöscht
    const res = await pool.query(`DELETE FROM customcommands WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(command),
    ]);
    return res.rowCount > 0;
}

/** Löst einen Namen (Command oder Alias) zum Command auf – wie resolveAlias im alten Bot. */
export async function resolveCommand(channel, name) {
    const { rows } = await pool.query(
        `SELECT ${CMD_COLS} FROM customcommands
         WHERE channel = $1 AND command = COALESCE(
            (SELECT a.command FROM aliases a WHERE a.channel = $1 AND a.alias = $2),
            $2
         ) LIMIT 1;`,
        [ch(channel), store(name)],
    );
    return rows[0] ?? null;
}

export async function incrementUses(channel, command) {
    await pool.query(`UPDATE customcommands SET uses = uses + 1 WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(command),
    ]);
}

/* ------------------------------- Aliase ------------------------------- */

/** @param {{onlyEnabled?: boolean}} options onlyEnabled: Aliase ausgeschalteter Commands weglassen */
export async function listAliases(channel, { onlyEnabled = false } = {}) {
    const { rows } = await pool.query(
        `SELECT regexp_replace(a.alias, '^!', '') AS alias, regexp_replace(a.command, '^!', '') AS command
         FROM aliases a
         ${onlyEnabled ? "JOIN customcommands c ON c.channel = a.channel AND c.command = a.command AND c.enabled IS NOT FALSE" : ""}
         WHERE a.channel = $1 ORDER BY a.command, a.alias;`,
        [ch(channel)],
    );
    return rows;
}

/** @returns {"ok"|"no_command"|"exists"|"is_command"} */
export async function addAlias(channel, alias, command) {
    const target = await pool.query(`SELECT 1 FROM customcommands WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(command),
    ]);
    if (target.rowCount === 0) return "no_command";
    const clash = await pool.query(`SELECT 1 FROM customcommands WHERE channel = $1 AND command = $2;`, [
        ch(channel),
        store(alias),
    ]);
    if (clash.rowCount > 0) return "is_command";
    const res = await pool.query(
        `INSERT INTO aliases (channel, alias, command) VALUES ($1, $2, $3)
         ON CONFLICT (channel, alias) DO NOTHING RETURNING alias;`,
        [ch(channel), store(alias), store(command)],
    );
    return res.rowCount > 0 ? "ok" : "exists";
}

export async function deleteAlias(channel, alias) {
    const res = await pool.query(`DELETE FROM aliases WHERE channel = $1 AND alias = $2;`, [ch(channel), store(alias)]);
    return res.rowCount > 0;
}
