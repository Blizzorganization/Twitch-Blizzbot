/** Dashboard-Routen: Commands, Aliase und Zähler */
import { commands as internalCommands } from "../../twitch/commands.js";
import { config, PERMISSION_NAMES, permissionFromName } from "../../config.js";
import { listCommands, addCommand, editCommand, deleteCommand, renameCommand, getCommand, getAlias, setCommandEnabled, setAllCommandsEnabled, listAliases, addAlias, deleteAlias, listInternalStates, setInternalEnabled } from "../../db/commands.js";
import { allCounters, newCounter, editCounter, setCounter, delCounter } from "../../db/counters.js";
import { logAudit } from "../../db/audit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerCommands(api) {
    /* Commands */
    // Fest einprogrammierte Commands - für den Unterpunkt "Standard Befehle" im Dashboard, inkl. An/Aus pro Kanal
    api.get("/commands/builtin", channelAccessMiddleware, wrap(async (req, res) => {
        const states = new Map((await listInternalStates(channelOf(req))).map((s) => [s.command, s]));
        const rows = Object.entries(internalCommands)
            .filter(([name]) => name !== "help") // !help ist immer an und taucht deshalb nicht in der Liste auf
            .map(([name, c]) => ({
                command: name,
                aliases: c.alias ?? [],
                permission: PERMISSION_NAMES[c.perm ?? 0] ?? "everyone",
                desc: c.desc ?? "",
                modRows: c.modRows ?? [],
                locked: name === "help" || name === "switch",
                enabled: name === "help" || name === "switch" ? true : states.get(name)?.enabled ?? true,
            }))
            .sort((a, b) => a.command.localeCompare(b.command));
        res.json(rows);
    }));
    api.put("/commands/builtin/:name/enabled", channelAccessMiddleware, wrap(async (req, res) => {
        const name = req.params.name.toLowerCase();
        if (!internalCommands[name]) return res.status(404).json({ error: "Diesen Standard-Befehl gibt es nicht." });
        if ((name === "help" || name === "switch") && !req.body.enabled) {
            return res.status(400).json({ error: `!${name} kann nicht ausgeschaltet werden.` });
        }
        await setInternalEnabled(channelOf(req), name, !!req.body.enabled);
        logAudit({
            actor: req.user.username,
            action: "edit",
            targetType: "builtin-command",
            target: name,
            channel: channelOf(req),
            details: { enabled: !!req.body.enabled },
        });
        res.json({ ok: true });
    }));
    api.get("/commands", channelAccessMiddleware, wrap(async (req, res) => res.json(await listCommands(channelOf(req)))));
    api.post("/commands", channelAccessMiddleware, wrap(async (req, res) => {
        const { command, response, permission, cooldown } = req.body;
        if (!command || !response) return res.status(400).json({ error: "command und response sind Pflicht" });
        const ok = await addCommand(channelOf(req), command, response, {
            permission: permissionFromName(permission),
            cooldown: cooldown ?? config.bot.defaultCooldown,
        });
        if (ok) logAudit({ actor: req.user.username, action: "create", targetType: "command", target: String(command).toLowerCase(), channel: channelOf(req) });
        res.status(ok ? 201 : 409).json({ ok, error: ok ? undefined : "Command existiert bereits" });
    }));
    /* Bulk: alle Commands eines Kanals auf einmal ein-/ausschalten (Pfad VOR /commands/:name registrieren!) */
    api.put("/commands/enabled-all", channelAccessMiddleware, wrap(async (req, res) => {
        const n = await setAllCommandsEnabled(channelOf(req), !!req.body.enabled);
        logAudit({ actor: req.user.username, action: "edit", targetType: "command", target: "*", channel: channelOf(req), details: { bulk: true, enabled: !!req.body.enabled, count: n } });
        res.json({ ok: true, count: n });
    }));
    api.put("/commands/:name/enabled", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await setCommandEnabled(channelOf(req), req.params.name, !!req.body.enabled);
        if (ok) logAudit({ actor: req.user.username, action: "edit", targetType: "command", target: req.params.name.toLowerCase(), channel: channelOf(req), details: { enabled: !!req.body.enabled } });
        res.status(ok ? 200 : 404).json({ ok });
    }));
    api.put("/commands/:name", channelAccessMiddleware, wrap(async (req, res) => {
        const { response, permission, cooldown } = req.body;
        const ok = await editCommand(channelOf(req), req.params.name, response, {
            permission: permission === undefined ? undefined : permissionFromName(permission),
            cooldown,
        });
        if (ok) logAudit({ actor: req.user.username, action: "edit", targetType: "command", target: req.params.name.toLowerCase(), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
    /* Umbenennen (wie !recmd): Aliase und Aufrufzähler gehen mit, die Antwort bleibt. Pfad VOR /commands/:name nicht nötig (anderer Pfad). */
    api.put("/commands/:name/rename", channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        const oldName = req.params.name.toLowerCase();
        const newName = String(req.body.newName ?? "").trim().toLowerCase().replace(/^!+/, "");
        if (!newName || /\s/.test(newName) || newName.length > 50) {
            return res.status(400).json({ error: "Der neue Name darf nicht leer sein, keine Leerzeichen enthalten und höchstens 50 Zeichen lang sein." });
        }
        if (!(await getCommand(channel, oldName))) return res.status(404).json({ error: "Diesen Command gibt es nicht." });
        if (newName === oldName) return res.json({ ok: true });
        if ((await getCommand(channel, newName)) || (await getAlias(channel, newName))) {
            return res.status(409).json({ error: `Es gibt bereits einen Command oder Alias „${newName}".` });
        }
        await renameCommand(channel, oldName, newName);
        logAudit({ actor: req.user.username, action: "edit", targetType: "command", target: oldName, channel, details: { renamedTo: newName } });
        res.json({ ok: true, name: newName });
    }));
    api.delete("/commands/:name", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await deleteCommand(channelOf(req), req.params.name);
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "command", target: req.params.name.toLowerCase(), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));

    /* Aliase */
    api.get("/aliases", channelAccessMiddleware, wrap(async (req, res) => res.json(await listAliases(channelOf(req)))));
    api.post("/aliases", channelAccessMiddleware, wrap(async (req, res) => {
        const { alias, command } = req.body;
        if (!alias || !command) return res.status(400).json({ error: "alias und command sind Pflicht" });
        const r = await addAlias(channelOf(req), alias, command);
        if (r === "ok") logAudit({ actor: req.user.username, action: "create", targetType: "alias", target: String(alias).toLowerCase(), channel: channelOf(req), details: { command } });
        res.status(r === "ok" ? 201 : 409).json({ ok: r === "ok", result: r });
    }));
    api.delete("/aliases/:alias", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await deleteAlias(channelOf(req), req.params.alias);
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "alias", target: req.params.alias.toLowerCase(), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));

    /* Zähler (Tabelle counters: channel, name, cur, inc) */
    api.get("/counters", channelAccessMiddleware, wrap(async (req, res) => res.json(await allCounters(channelOf(req)))));
    api.post("/counters", channelAccessMiddleware, wrap(async (req, res) => {
        const name = String(req.body.name ?? "").trim();
        if (!name) return res.status(400).json({ error: "name ist Pflicht" });
        const inc = Number.isInteger(Number(req.body.inc)) ? Number(req.body.inc) : 1;
        const start = Number.isInteger(Number(req.body.start)) ? Number(req.body.start) : 0;
        const ok = await newCounter(channelOf(req), name, inc, start);
        if (ok) logAudit({ actor: req.user.username, action: "create", targetType: "counter", target: name.toLowerCase(), channel: channelOf(req), details: { inc, start } });
        res.status(ok ? 201 : 409).json({ ok, error: ok ? undefined : "Diesen Zähler gibt es bereits" });
    }));
    api.put("/counters/:name", channelAccessMiddleware, wrap(async (req, res) => {
        const { name } = req.params;
        if (req.body.value !== undefined) await setCounter(channelOf(req), name, Number(req.body.value));
        if (req.body.inc !== undefined) await editCounter(channelOf(req), name, Number(req.body.inc));
        logAudit({ actor: req.user.username, action: "edit", targetType: "counter", target: name.toLowerCase(), channel: channelOf(req), details: { value: req.body.value, inc: req.body.inc } });
        res.json({ ok: true });
    }));
    api.delete("/counters/:name", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await delCounter(channelOf(req), req.params.name);
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "counter", target: req.params.name.toLowerCase(), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
