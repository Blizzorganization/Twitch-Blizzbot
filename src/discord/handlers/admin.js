import { config, PERMISSIONS, permissionFromName } from "../../config.js";
import { getTable } from "../../utils/table.js";
import { addCommand, editCommand, deleteCommand, addAlias, deleteAlias, listCommandNames, listAliases, getCommand, getAlias } from "../../db/commands.js";
import { allCounters } from "../../db/counters.js";
import { addBlacklist, updateBlacklist, deleteBlacklist, listBlacklist, invalidateBlacklistCache } from "../../db/blacklist.js";
import { logAudit } from "../../db/audit.js";
import { addBotMod, removeBotMod, listBotMods } from "../../db/bot-mods.js";
import { commandInfoEmbed, botCommandsEmbed } from "../embeds.js";
import { sendBlacklist } from "../blacklist-channel.js";
import { P, cn } from "../util.js";

/** Aliase pro Ziel-Command gruppieren (Reihenfolge wie geliefert): Map command -> [alias, ...]. */
function groupAliases(rows) {
    const map = new Map();
    for (const r of rows) map.set(r.command, [...(map.get(r.command) ?? []), r.alias]);
    return map;
}

/** Verwaltungs-Commands (/add, /edit, /del je mit command/alias/blacklist, dazu /view /commands /aliase /blacklist). */
export async function handleAdmin(interaction) {
    const channel = (interaction.options.getString("channel") ?? config.discord.twitchChannel ?? "").toLowerCase();
    if (!channel) return "Es ist kein Twitch-Kanal konfiguriert (DISCORD_TWITCH_CHANNEL).";
    const g = (n) => interaction.options.getString(n);

    const actor = `${interaction.user.tag} (Discord)`;

    switch (interaction.commandName) {
        case "add": {
            const sub = interaction.options.getSubcommand();
            if (sub === "command") {
                const ok = await addCommand(channel, g("name"), g("antwort"), {
                    permission: permissionFromName(g("berechtigung")),
                    cooldown: interaction.options.getInteger("cooldown") ?? config.bot.defaultCooldown,
                });
                if (ok) logAudit({ actor, action: "create", targetType: "command", target: cn(g("name")), channel });
                return ok ? `✅ Command \`${P}${cn(g("name"))}\` hinzugefügt.` : "⚠️ Den Command gibt es bereits – nutze `/edit command`.";
            }
            if (sub === "alias") {
                const r = await addAlias(channel, g("alias"), g("command"));
                if (r === "ok") logAudit({ actor, action: "create", targetType: "alias", target: cn(g("alias")), channel, details: { command: g("command") } });
                return {
                    ok: `✅ Alias \`${P}${cn(g("alias"))}\` → \`${P}${cn(g("command"))}\` angelegt.`,
                    no_command: "⚠️ Der Ziel-Command existiert nicht.",
                    exists: "⚠️ Dieser Alias existiert bereits.",
                    is_command: "⚠️ Es gibt schon einen Command mit diesem Namen.",
                }[r];
            }
            const word = g("wort").toLowerCase();
            const ok = await addBlacklist(channel, word, interaction.options.getInteger("aktion"));
            invalidateBlacklistCache(channel);
            return ok ? `✅ "${word}" wurde in die Blacklist eingetragen.` : "⚠️ Der Eintrag existiert bereits – nutze `/edit blacklist`.";
        }
        case "edit": {
            if (interaction.options.getSubcommand() === "blacklist") {
                const word = g("wort").toLowerCase();
                const ok = await updateBlacklist(channel, word, interaction.options.getInteger("aktion"));
                invalidateBlacklistCache(channel);
                return ok ? `✅ Aktion für "${word}" geändert.` : `⚠️ "${word}" ist nicht in der Blacklist.`;
            }
            const perm = g("berechtigung");
            const ok = await editCommand(channel, g("name"), g("antwort"), {
                permission: perm ? permissionFromName(perm) : undefined,
                cooldown: interaction.options.getInteger("cooldown") ?? undefined,
            });
            if (ok) logAudit({ actor, action: "edit", targetType: "command", target: cn(g("name")), channel });
            return ok ? `✅ Command \`${P}${cn(g("name"))}\` geändert.` : "⚠️ Diesen Command gibt es nicht.";
        }
        case "del": {
            const sub = interaction.options.getSubcommand();
            if (sub === "alias") {
                const ok = await deleteAlias(channel, g("alias"));
                if (ok) logAudit({ actor, action: "delete", targetType: "alias", target: cn(g("alias")), channel });
                return ok ? `🗑️ Alias \`${P}${cn(g("alias"))}\` gelöscht.` : "⚠️ Diesen Alias gibt es nicht.";
            }
            if (sub === "blacklist") {
                const word = g("wort").toLowerCase();
                const ok = await deleteBlacklist(channel, word);
                invalidateBlacklistCache(channel);
                return ok ? `🗑️ "${word}" wurde von der Blacklist entfernt.` : `⚠️ "${word}" ist nicht in der Blacklist.`;
            }
            const ok = await deleteCommand(channel, g("name"));
            if (ok) logAudit({ actor, action: "delete", targetType: "command", target: cn(g("name")), channel });
            return ok ? `🗑️ Command \`${P}${cn(g("name"))}\` gelöscht (inkl. Aliase).` : "⚠️ Diesen Command gibt es nicht.";
        }
        case "view": {
            // Wieder als Embed wie im alten Bot ("Command-Info:"), jetzt zusätzlich mit Cooldown.
            const name = g("name");
            let resolved = cn(name);
            let cmd = await getCommand(channel, resolved);
            if (!cmd) {
                const alias = await getAlias(channel, name);
                if (alias) {
                    resolved = cn(alias.command);
                    cmd = await getCommand(channel, resolved);
                }
            }
            if (!cmd) return `⚠️ Diesen Command (oder Alias) gibt es nicht: \`${name}\``;
            const aliases = (await listAliases(channel)).filter((a) => a.command === resolved).map((a) => `${P}${a.alias}`);
            const isMod = (cmd.permission ?? 0) >= PERMISSIONS.MODERATOR;
            const embed = commandInfoEmbed({
                botAvatarUrl: interaction.client.user.displayAvatarURL(),
                prefix: P,
                name: resolved,
                response: cmd.response,
                aliases,
                cooldown: cmd.cooldown,
                isMod,
            });
            return { embeds: [embed] };
        }
        case "commands": {
            // Übersicht wie "!cmd" im alten Bot: NUR die Custom Commands, Mod-Commands, Aliase und Zähler
            // des Kanals in einem Embed - die fest einprogrammierten (Standard-)Commands werden bewusst NICHT aufgelistet.
            const everyone = await listCommandNames(channel, PERMISSIONS.EVERYONE);
            const mod = await listCommandNames(channel, PERMISSIONS.MODERATOR);
            const aliases = await listAliases(channel, { onlyEnabled: true }); // Aliase ausgeschalteter Commands erscheinen nicht
            const counters = await allCounters(channel);
            const embed = botCommandsEmbed({
                botAvatarUrl: interaction.client.user.displayAvatarURL(),
                everyone,
                mod,
                // gruppiert pro Command: "!setup= !amazon, !equip, !pc"
                aliases: [...groupAliases(aliases)].map(([command, list]) => `${P}${command}= ${list.map((a) => `${P}${a}`).join(", ")}`),
                counters: counters.map((c) => c.name),
            });
            return { embeds: [embed] };
        }
        case "aliase": {
            const rows = await listAliases(channel);
            return rows.length
                ? "**Aliase:**\n" + rows.map((r) => `\`${P}${r.alias}\` → \`${P}${r.command}\``).join("\n")
                : "Es gibt noch keine Aliase.";
        }
        case "blacklist": {
            if (config.discord.blacklistChannelId) {
                await sendBlacklist(channel);
                return "✅ Die Blacklist wurde in den Blacklist-Kanal gesendet.";
            }
            const rows = await listBlacklist(channel);
            return rows.length ? "```fix\n" + getTable(rows.map((r) => ({ word: r.word, action: r.action }))).slice(0, 1900) + "```" : "Die Blacklist ist leer.";
        }
        case "addmod": {
            const name = g("name").trim().replace(/^@/, "").toLowerCase();
            if (!/^[a-z0-9_]{1,25}$/.test(name)) return "⚠️ Das ist kein gültiger Twitch-Name.";
            const { added } = await addBotMod(channel, name, actor);
            if (added) logAudit({ actor, action: "create", targetType: "bot-mod", target: name, channel });
            return added ? `✅ **${name}** ist jetzt Verify-Mod.` : `⚠️ **${name}** ist schon eingetragen.`;
        }
        case "delmod": {
            const name = g("name").trim().replace(/^@/, "").toLowerCase();
            const ok = await removeBotMod(channel, name);
            if (ok) logAudit({ actor, action: "delete", targetType: "bot-mod", target: name, channel });
            return ok ? `🗑️ **${name}** ist kein Verify-Mod mehr.` : `⚠️ **${name}** ist nicht eingetragen.`;
        }
        case "mods": {
            const rows = await listBotMods(channel);
            return rows.length
                ? "**Verify-Mods:**\n" + rows.map((r) => `• ${r.username}`).join("\n")
                : "Es sind keine Verify-Mods eingetragen.";
        }
        default:
            return "Unbekannter Befehl.";
    }
}
