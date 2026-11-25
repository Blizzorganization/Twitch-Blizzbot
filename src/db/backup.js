import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { getChannelSettings, updateChannelSettings, SETTINGS_FIELDS } from "./channel-settings.js";
import { ALERT_TYPES } from "./alerts.js";
import { UserError } from "../utils/errors.js";
import { refreshBotMods } from "./bot-mods.js";

/**
 * Export/Import der Kanal-Daten als JSON.
 * Nicht enthalten (absichtlich): Twitch-Tokens, Dashboard-Benutzer, Watchtime/XP/Punkte der Zuschauer,
 * Giveaways/Umfragen/Wetten (Verlauf) und das Audit-Log.
 * Neuere Bereiche (Begrüßungen, Verify-Mods) fehlen in älteren Sicherungen - die Version bleibt 1, da nur ergänzt wurde.
 */
export const BACKUP_VERSION = 1;

export const BACKUP_SECTIONS = {
    commands: "Commands (inkl. Aliase)",
    internalCommands: "Eingebaute Commands (an/aus, Rechte)",
    counters: "Counter",
    blacklist: "Blacklist",
    automessages: "Automessages",
    quotes: "Zitate",
    alerts: "Alert-Texte",
    greetings: "Begrüßungen",
    verifyMods: "Verify-Mods (Liste)",
    settings: "Kanal-Einstellungen",
};

const ch = cleanChannel;
const store = (s) => "!" + String(s).trim().toLowerCase().replace(/^!+/, "");
const bare = (s) => String(s ?? "").trim().toLowerCase().replace(/^!+/, "");

/* ------------------------------ Export ------------------------------ */

export async function exportChannel(channel) {
    const c = ch(channel);
    const q = async (sql) => (await pool.query(sql, [c])).rows;

    const commands = (await q(
        `SELECT regexp_replace(command, '^!', '') AS command, response, COALESCE(permissions, 0) AS permission,
                cooldown, uses, enabled
         FROM customcommands WHERE channel = $1 ORDER BY command;`,
    ));
    const aliases = await q(
        `SELECT regexp_replace(alias, '^!', '') AS alias, regexp_replace(command, '^!', '') AS command
         FROM aliases WHERE channel = $1 ORDER BY alias;`,
    );
    const internalCommands = await q(
        `SELECT regexp_replace(command, '^!', '') AS command, permission, enabled FROM commands WHERE channel = $1 ORDER BY command;`,
    );
    const counters = await q(`SELECT name, cur, inc FROM counters WHERE channel = $1 ORDER BY name;`);
    const blacklist = await q(`SELECT blword AS word, action FROM blacklist WHERE channel = $1 ORDER BY blword;`);
    const automessages = await q(`SELECT message, delay_minutes AS "delayMinutes", standalone FROM automessages WHERE channel = $1 ORDER BY id;`);
    const quotes = await q(`SELECT id, text, added_by AS "addedBy", created_at AS "createdAt" FROM quotes WHERE channel = $1 ORDER BY id;`);
    const alerts = await q(`SELECT event_type AS "type", template, enabled, COALESCE(as_action, false) AS "asAction" FROM alert_messages WHERE channel = $1 ORDER BY event_type;`);
    const greetings = await q(`SELECT username, message, enabled FROM chat_greetings WHERE channel = $1 ORDER BY username;`);
    const verifyMods = await q(`SELECT username FROM bot_mods WHERE channel = $1 ORDER BY username;`);

    // Nur eigene (in der DB gesetzte) Werte exportieren - Standardwerte bleiben Standard
    const cur = await getChannelSettings(c);
    const settings = {};
    for (const [field, { column }] of Object.entries(SETTINGS_FIELDS)) {
        const raw = cur._raw?.[column];
        if (raw !== null && raw !== undefined) settings[field] = raw;
    }

    return {
        app: "blizzbot",
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        channel: c,
        data: { commands, aliases, internalCommands, counters, blacklist, automessages, quotes, alerts, greetings, verifyMods, settings },
    };
}

/* ------------------------------ Import ------------------------------ */

const isStr = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const arr = (v) => (Array.isArray(v) ? v : []);

/** Prüft die Datei und gibt sie bereinigt zurück (wirft UserError bei grundlegenden Fehlern). */
export function validateBackup(file) {
    if (!file || typeof file !== "object" || file.app !== "blizzbot" || typeof file.data !== "object" || !file.data) {
        throw new UserError("Das ist keine gültige Blizzbot-Sicherung.");
    }
    if (file.version !== BACKUP_VERSION) throw new UserError(`Nicht unterstützte Sicherungs-Version: ${file.version}`);
    return file.data;
}

/**
 * Importiert eine Sicherung in einen Kanal.
 *  - mode "merge":   vorhandene Einträge bleiben, nur fehlende werden ergänzt
 *  - mode "replace": die gewählten Bereiche werden zuerst geleert und dann aus der Datei gefüllt
 *  - dryRun: nichts wird gespeichert, es werden nur die Zahlen zurückgegeben
 * Rückgabe pro Bereich: { added, skipped, invalid }
 */
export async function importChannel(channel, file, { mode = "merge", sections, dryRun = false } = {}) {
    const data = validateBackup(file);
    if (!["merge", "replace"].includes(mode)) throw new UserError("Ungültiger Import-Modus.");
    const wanted = new Set((sections?.length ? sections : Object.keys(BACKUP_SECTIONS)).filter((s) => s in BACKUP_SECTIONS));
    const replace = mode === "replace";
    const c = ch(channel);
    await ensureChannel(c);

    const result = {};
    const res = (name) => (result[name] ||= { added: 0, skipped: 0, invalid: 0 });
    const client = await pool.connect();
    let settingsToApply = null;
    try {
        await client.query("BEGIN");
        const run = (sql, params) => client.query(sql, params);

        if (wanted.has("commands")) {
            const r = res("commands");
            const ra = res("aliases");
            if (replace) {
                await run(`DELETE FROM customcommands WHERE channel = $1;`, [c]); // Aliase per CASCADE
            }
            for (const cmd of arr(data.commands)) {
                const name = bare(cmd?.command);
                const response = typeof cmd?.response === "string" ? cmd.response : null;
                const permission = cmd?.permission ?? 0;
                const cooldown = cmd?.cooldown ?? 5;
                if (!name || name.length > 50 || /\s/.test(name) || !isStr(response, 2000) || !isInt(permission, 0, 10) || !isInt(cooldown, 0, 86400)) {
                    r.invalid++;
                    continue;
                }
                const clash = await run(`SELECT 1 FROM aliases WHERE channel = $1 AND alias = $2;`, [c, store(name)]);
                if (clash.rowCount > 0) { r.skipped++; continue; }
                const ins = await run(
                    `INSERT INTO customcommands (channel, command, response, permissions, cooldown, uses, enabled)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (channel, command) DO NOTHING;`,
                    [c, store(name), response, permission, cooldown, isInt(cmd.uses, 0, 2147483647) ? cmd.uses : 0, cmd.enabled !== false],
                );
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
            for (const al of arr(data.aliases)) {
                const alias = bare(al?.alias);
                const target = bare(al?.command);
                if (!alias || !target || alias.length > 50 || /\s/.test(alias)) { ra.invalid++; continue; }
                const hasTarget = await run(`SELECT 1 FROM customcommands WHERE channel = $1 AND command = $2;`, [c, store(target)]);
                const isCmd = await run(`SELECT 1 FROM customcommands WHERE channel = $1 AND command = $2;`, [c, store(alias)]);
                if (hasTarget.rowCount === 0 || isCmd.rowCount > 0) { ra.skipped++; continue; }
                const ins = await run(
                    `INSERT INTO aliases (channel, alias, command) VALUES ($1, $2, $3) ON CONFLICT (channel, alias) DO NOTHING;`,
                    [c, store(alias), store(target)],
                );
                ins.rowCount > 0 ? ra.added++ : ra.skipped++;
            }
        }

        if (wanted.has("internalCommands")) {
            const r = res("internalCommands");
            if (replace) await run(`DELETE FROM commands WHERE channel = $1;`, [c]);
            for (const ic of arr(data.internalCommands)) {
                const name = bare(ic?.command);
                if (!name || name.length > 50 || !isInt(ic?.permission ?? 0, 0, 10)) { r.invalid++; continue; }
                const ins = await run(
                    `INSERT INTO commands (channel, command, permission, enabled) VALUES ($1, $2, $3, $4)
                     ON CONFLICT (channel, command) DO NOTHING;`,
                    [c, store(name), ic.permission ?? 0, ic.enabled !== false],
                );
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
        }

        if (wanted.has("counters")) {
            const r = res("counters");
            if (replace) await run(`DELETE FROM counters WHERE channel = $1;`, [c]);
            for (const ct of arr(data.counters)) {
                const name = String(ct?.name ?? "").trim().toLowerCase();
                if (!name || name.length > 50 || !isInt(ct?.cur ?? 0, -2147483648, 2147483647) || !isInt(ct?.inc ?? 1, -1000000, 1000000)) { r.invalid++; continue; }
                const ins = await run(
                    `INSERT INTO counters (channel, name, cur, inc) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING;`,
                    [c, name, ct.cur ?? 0, ct.inc ?? 1],
                );
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
        }

        if (wanted.has("blacklist")) {
            const r = res("blacklist");
            if (replace) await run(`DELETE FROM blacklist WHERE channel = $1;`, [c]);
            for (const b of arr(data.blacklist)) {
                const word = String(b?.word ?? "").trim().toLowerCase();
                if (!word || word.length > 200 || !isInt(b?.action ?? 0, 0, 10)) { r.invalid++; continue; }
                const ins = await run(
                    `INSERT INTO blacklist (channel, blword, action) VALUES ($1, $2, $3) ON CONFLICT (channel, blword) DO NOTHING;`,
                    [c, word, b.action ?? 0],
                );
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
        }

        if (wanted.has("automessages")) {
            const r = res("automessages");
            if (replace) await run(`DELETE FROM automessages WHERE channel = $1;`, [c]);
            for (const a of arr(data.automessages)) {
                const message = a?.message;
                const delay = a?.delayMinutes ?? null;
                if (!isStr(message, 500) || (delay !== null && !isInt(delay, 1, 10080))) { r.invalid++; continue; }
                const dup = await run(`SELECT 1 FROM automessages WHERE channel = $1 AND message = $2;`, [c, message]);
                if (dup.rowCount > 0) { r.skipped++; continue; }
                await run(`INSERT INTO automessages (channel, message, delay_minutes, standalone) VALUES ($1, $2, $3, $4);`, [c, message, delay, a?.standalone === true]);
                r.added++;
            }
        }

        if (wanted.has("quotes")) {
            const r = res("quotes");
            if (replace) await run(`DELETE FROM quotes WHERE channel = $1;`, [c]);
            for (const qt of arr(data.quotes)) {
                if (!isStr(qt?.text, 1000)) { r.invalid++; continue; }
                const dup = await run(`SELECT 1 FROM quotes WHERE channel = $1 AND text = $2;`, [c, qt.text]);
                if (dup.rowCount > 0) { r.skipped++; continue; }
                // Ursprüngliche Nummer behalten, wenn frei - sonst nächste freie Nummer
                let id = isInt(qt.id, 1, 2147483000) ? qt.id : null;
                if (id !== null) {
                    const used = await run(`SELECT 1 FROM quotes WHERE channel = $1 AND id = $2;`, [c, id]);
                    if (used.rowCount > 0) id = null;
                }
                if (id === null) {
                    const m = await run(`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM quotes WHERE channel = $1;`, [c]);
                    id = m.rows[0].id;
                }
                const createdAt = qt.createdAt && !Number.isNaN(Date.parse(qt.createdAt)) ? new Date(qt.createdAt) : new Date();
                await run(
                    `INSERT INTO quotes (id, channel, text, added_by, created_at) VALUES ($1, $2, $3, $4, $5);`,
                    [id, c, qt.text, typeof qt.addedBy === "string" ? qt.addedBy.slice(0, 64) : null, createdAt],
                );
                r.added++;
            }
        }

        if (wanted.has("alerts")) {
            const r = res("alerts");
            if (replace) await run(`DELETE FROM alert_messages WHERE channel = $1;`, [c]);
            for (const a of arr(data.alerts)) {
                if (!(a?.type in ALERT_TYPES) || (a.template !== null && a.template !== undefined && !isStr(a.template, 500))) { r.invalid++; continue; }
                const ins = await run(
                    `INSERT INTO alert_messages (channel, event_type, template, enabled, as_action) VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (channel, event_type) DO NOTHING;`,
                    [c, a.type, a.template ?? null, a.enabled !== false, a.asAction === true],
                );
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
        }

        // Ältere Sicherungen kennen Begrüßungen/Verify-Mods noch nicht: dann beim Ersetzen NICHTS leeren
        if (wanted.has("greetings") && "greetings" in data) {
            const r = res("greetings");
            if (replace) await run(`DELETE FROM chat_greetings WHERE channel = $1;`, [c]);
            for (const g of arr(data.greetings)) {
                const name = String(g?.username ?? "").trim().replace(/^@/, "").toLowerCase();
                if (!/^[a-z0-9_]{1,25}$/.test(name) || !isStr(g?.message, 400)) { r.invalid++; continue; }
                const ins = await run(
                    `INSERT INTO chat_greetings (channel, username, message, enabled) VALUES ($1, $2, $3, $4) ON CONFLICT (channel, username) DO NOTHING;`,
                    [c, name, g.message, g.enabled !== false],
                );
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
        }

        if (wanted.has("verifyMods") && "verifyMods" in data) {
            const r = res("verifyMods");
            if (replace) await run(`DELETE FROM bot_mods WHERE channel = $1;`, [c]);
            for (const m of arr(data.verifyMods)) {
                const name = String(m?.username ?? m ?? "").trim().replace(/^@/, "").toLowerCase();
                if (!/^[a-z0-9_]{1,25}$/.test(name)) { r.invalid++; continue; }
                const ins = await run(`INSERT INTO bot_mods (channel, username, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`, [c, name, "Sicherung"]);
                ins.rowCount > 0 ? r.added++ : r.skipped++;
            }
        }

        if (wanted.has("settings")) {
            const r = res("settings");
            const incoming = data.settings && typeof data.settings === "object" ? data.settings : {};
            const cur = (await getChannelSettings(c))._raw ?? {};
            const updates = {};
            for (const [field, value] of Object.entries(incoming)) {
                const def = SETTINGS_FIELDS[field];
                if (!def) { r.invalid++; continue; }
                const ok = typeof value === "number" || typeof value === "boolean" || typeof value === "string" || Array.isArray(value);
                if (!ok) { r.invalid++; continue; }
                const existing = cur[def.column];
                if (!replace && existing !== null && existing !== undefined) { r.skipped++; continue; }
                updates[field] = value;
                r.added++;
            }
            // Beim Ersetzen werden nicht enthaltene Felder auf "Standard" zurückgesetzt
            if (replace) for (const field of Object.keys(SETTINGS_FIELDS)) if (!(field in updates)) updates[field] = null;
            settingsToApply = updates;
        }

        await client.query(dryRun ? "ROLLBACK" : "COMMIT");
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
    } finally {
        client.release();
    }

    // Einstellungen laufen über die vorhandene Funktion (eigene Verbindung) - erst nach erfolgreichem Commit
    if (settingsToApply && !dryRun && Object.keys(settingsToApply).length) {
        await updateChannelSettings(c, settingsToApply);
    }
    if (!dryRun && wanted.has("verifyMods")) await refreshBotMods(); // Rechte sofort neu laden (und ob "nur Verify-Mods" gilt)
    return { mode, dryRun, sections: [...wanted], result };
}
