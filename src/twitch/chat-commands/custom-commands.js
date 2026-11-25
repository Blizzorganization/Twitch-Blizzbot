import { getCommand, getAlias, renameCommand, addAlias, deleteAlias, listCommandNames, listAliases, transferCommand, addCommand, editCommand, deleteCommand } from "../../db/commands.js";
import { logAudit } from "../../db/audit.js";
import { P, bang, parseFlags } from "./shared.js";

/* --------------------- Abläufe für die Custom-Command-Verwaltung --------------------- */

async function addCommandFlow(ctx, permission, label) {
    if (ctx.args.length <= 1) return ctx.say(`Du musst angeben, welchen ${label} und welche Antwort du hinzufügen möchtest.`);
    const [name, ...rest] = ctx.args;
    const { opts, text } = parseFlags(rest.join(" "));
    if (!text) return ctx.say("Du musst angeben, was die Antwort sein soll.");
    if ((await getCommand(ctx.channel, name)) || (await getAlias(ctx.channel, name))) {
        return ctx.say(`${ctx.user}, der Command existiert bereits`);
    }
    await addCommand(ctx.channel, name, text, { permission, ...opts });
    logAudit({ actor: `${ctx.user} (Twitch)`, action: "create", targetType: "command", target: name.toLowerCase(), channel: ctx.channel });
    ctx.say(`${ctx.user}, der ${label} ${name.toLowerCase()} wurde hinzugefügt.`);
}

async function editCommandFlow(ctx, permission, label, unknownWord) {
    if (!ctx.args.length) return ctx.say(`Welchen ${label} möchtest du bearbeiten?`);
    const cmd = await getCommand(ctx.channel, ctx.args[0]);
    if (!cmd) return ctx.say(`Ich kenne keinen ${unknownWord} ${ctx.args[0]}.`);
    if ((cmd.permission ?? 0) !== permission) {
        return ctx.say(`${ctx.args[0]} ist kein ${permission === P.EVERYONE ? "Nutzer" : "Mod Only"} Customcommand.`);
    }
    const { opts, text } = parseFlags(ctx.args.slice(1).join(" "));
    if (!text && !Object.keys(opts).length) return ctx.say("Du musst angeben, was die neue Antwort sein soll.");
    await editCommand(ctx.channel, ctx.args[0], text || null, opts);
    logAudit({ actor: `${ctx.user} (Twitch)`, action: "edit", targetType: "command", target: ctx.args[0].toLowerCase(), channel: ctx.channel });
    ctx.say(`${ctx.user}, der ${label} ${ctx.args[0].toLowerCase()} wurde editiert.`);
}

async function deleteCommandFlow(ctx, permission, label, doneWord) {
    if (!ctx.args.length) return ctx.say(`Du musst einen ${label} angeben, der gelöscht werden soll.`);
    const cmd = await getCommand(ctx.channel, ctx.args[0]);
    if (!cmd) return ctx.say(`Ich kenne keinen Command ${ctx.args[0]}.`);
    if ((cmd.permission ?? 0) !== permission) {
        return ctx.say(`${ctx.args[0]} ist kein ${permission === P.EVERYONE ? "Nutzer" : "Mod Only"} Customcommand.`);
    }
    await deleteCommand(ctx.channel, ctx.args[0]);
    logAudit({ actor: `${ctx.user} (Twitch)`, action: "delete", targetType: "command", target: ctx.args[0].toLowerCase(), channel: ctx.channel });
    ctx.say(`${ctx.user}, der ${label} ${ctx.args[0]} wurde ${doneWord}.`);
}

/** Verwaltung der Custom Commands und Aliase */
export const customCommandsCommands = {
    add: {
        perm: P.MODERATOR,
        desc: "Legt einen neuen Custom Command für alle an.",
        run: (ctx) => addCommandFlow(ctx, P.EVERYONE, "Command"),
    },

    madd: {
        perm: P.MODERATOR,
        desc: "Legt einen neuen Custom Command mit Moderator-Rechten an.",
        run: (ctx) => addCommandFlow(ctx, P.MODERATOR, "Mod-Command"),
    },

    edit: {
        perm: P.MODERATOR,
        desc: "Ändert einen bestehenden Custom Command für alle.",
        run: (ctx) => editCommandFlow(ctx, P.EVERYONE, "Command", "Befehl"),
    },

    medit: {
        perm: P.MODERATOR,
        desc: "Ändert einen bestehenden Mod-Command.",
        run: (ctx) => editCommandFlow(ctx, P.MODERATOR, "Mod-Command", "Command"),
    },

    del: {
        perm: P.MODERATOR,
        desc: "Löscht einen Custom Command für alle.",
        run: (ctx) => deleteCommandFlow(ctx, P.EVERYONE, "Command", "entfernt"),
    },

    mdel: {
        perm: P.MODERATOR,
        desc: "Löscht einen Mod-Command.",
        run: (ctx) => deleteCommandFlow(ctx, P.MODERATOR, "Mod-Command", "gelöscht"),
    },

    recmd: {
        perm: P.MODERATOR,
        desc: "Benennt einen bestehenden Custom Command um.",
        run: async (ctx) => {
            if (!ctx.args.length) return ctx.say("Welchen Command möchtest du umbenennen?");
            const [commandName, newName] = ctx.args;
            if (!(await getCommand(ctx.channel, commandName))) return ctx.say(`Ich kenne keinen Command ${commandName}.`);
            if (!newName) return ctx.say(`Du musst angeben in was ${commandName} umbenannt werden soll.`);
            if ((await getCommand(ctx.channel, newName)) || (await getAlias(ctx.channel, newName))) {
                return ctx.say(`Es gibt bereits einen Command ${newName}`);
            }
            await renameCommand(ctx.channel, commandName, newName);
            ctx.say(`${ctx.user}, der Command ${commandName} wurde zu ${newName} umbenannt.`);
        },
    },

    addalias: {
        perm: P.MODERATOR,
        desc: "Legt einen neuen Alias für einen bestehenden Command an.",
        run: async (ctx) => {
            if (ctx.args.length <= 1) return ctx.say("Du musst angeben, welchen Alias und welchen Command du verwenden möchtest.");
            const [alias, ...rest] = ctx.args;
            const command = rest.join(" ");
            const existing = await getAlias(ctx.channel, alias);
            if (existing) return ctx.say(`Dieser Alias ist bereits vergeben für ${existing.command}.`);
            const r = await addAlias(ctx.channel, alias.toLowerCase(), command);
            if (r === "no_command") return ctx.say("Diesen Command kenne ich nicht.");
            if (r === "is_command") return ctx.say("Es gibt schon einen Command mit diesem Namen.");
            if (r === "exists") return ctx.say(`Dieser Alias ist bereits vergeben.`);
            logAudit({ actor: `${ctx.user} (Twitch)`, action: "create", targetType: "alias", target: alias.toLowerCase(), channel: ctx.channel, details: { command } });
            ctx.say(`${ctx.user}, der Alias ${alias.toLowerCase()} für ${command} wurde hinzugefügt.`);
        },
    },

    delalias: {
        perm: P.MODERATOR,
        desc: "Löscht einen Alias wieder.",
        run: async (ctx) => {
            if (!ctx.args.length) return ctx.say("Du musst angeben, welcher Alias gelöscht werden soll.");
            if (!(await getAlias(ctx.channel, ctx.args[0]))) {
                return ctx.say(`${ctx.user}, es gibt keinen Alias mit dem Namen ${ctx.args[0]}.`);
            }
            await deleteAlias(ctx.channel, ctx.args[0]);
            logAudit({ actor: `${ctx.user} (Twitch)`, action: "delete", targetType: "alias", target: ctx.args[0].toLowerCase(), channel: ctx.channel });
            ctx.say(`${ctx.user}, der Alias ${ctx.args[0]} wurde entfernt.`);
        },
    },

    ccmd: {
        perm: P.MODERATOR,
        alias: ["ccmds"],
        desc: "Listet alle Mod-Commands (Custom Commands mit Moderator-Rechten) auf.",
        run: async (ctx) => {
            const list = await listCommandNames(ctx.channel, P.MODERATOR);
            ctx.say(list.length ? `Es sind folgende Mod-Commands hinterlegt: ${list.join(", ")}` : "Es sind keine Mod-Commands hinterlegt.");
        },
    },

    aliase: {
        perm: P.MODERATOR,
        desc: "Listet alle angelegten Aliase auf.",
        run: async (ctx) => {
            const rows = await listAliases(ctx.channel);
            if (!rows.length) return ctx.say("Es gibt noch keine Aliase.");
            const grouped = new Map();
            for (const r of rows) {
                if (!grouped.has(r.command)) grouped.set(r.command, []);
                grouped.get(r.command).push(bang(r.alias));
            }
            const parts = [...grouped].map(([cmd, aliases]) => `${bang(cmd)}= ${aliases.join(", ")}`);
            ctx.say(`Folgende Aliase sind hinterlegt: ${parts.join(" | ")}`);
        },
    },

    transfer: {
        perm: P.MODERATOR,
        alias: ["tf"],
        desc: "Wechselt die Rechte eines Custom Commands zwischen \"für alle\" und \"nur Moderatoren\".",
        run: async (ctx) => {
            if (!ctx.args.length) {
                return ctx.say("Du musst angeben, welcher Befehl zwischen Nutzerbefehl und Moderationsbefehl gewechselt werden soll.");
            }
            const cmd = ctx.args[0].toLowerCase();
            const res = await transferCommand(ctx.channel, cmd, P.EVERYONE, P.MODERATOR);
            if (res === "no_such_command") {
                const alias = await getAlias(ctx.channel, cmd);
                if (alias) return ctx.say(`'${cmd}' ist ein Alias, wenn du wechseln möchtest nutze bitte den Befehl ${alias.command}.`);
                return ctx.say(`Der Befehl ${cmd} ist nicht vorhanden.`);
            }
            ctx.say(`Die Befehlsberechtigungen von ${cmd} wurden aktualisiert.`);
        },
    },
};
