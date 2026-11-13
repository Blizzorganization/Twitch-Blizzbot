import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";

/**
 * Alle Discord-Embeds des Bots liegen zentral in dieser Datei, statt über bot.js verteilt.
 * Die Farbe ist für ALLE Embeds gemeinsam: Standard 0xedbc5d, überschreibbar über
 * DISCORD_EMBED_COLOR in der configs/.env (z. B. "#1abc9c").
 */
export const COLOR = config.discord.embedColor;

/** "/view": Command-Info mit Antworttext, Aliasen und Cooldown (Fußzeile CCMD/MCMD). */
export function commandInfoEmbed({ botAvatarUrl, prefix, name, response, aliases, cooldown, isMod }) {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("__Command-Info:__")
        .setThumbnail(botAvatarUrl)
        .setDescription(`**${prefix}${name}**\n${response}`)
        .addFields(
            { name: "Aliase:", value: aliases.join(", ") || "Es sind keine Aliase zu diesem Befehl vorhanden" },
            { name: "Cooldown:", value: `${cooldown}s` },
        )
        .setFooter({ text: isMod ? "MCMD" : "CCMD" });
}

/** Teilt eine Liste in Stücke, die mit dem Trennzeichen höchstens 1024 Zeichen (Limit eines Embed-Felds) lang sind. */
function chunkItems(items, sep, limit = 1024) {
    const chunks = [];
    let cur = "";
    for (const it of items) {
        const text = String(it).slice(0, limit);
        if (cur && cur.length + sep.length + text.length > limit) {
            chunks.push(cur);
            cur = text;
        } else {
            cur = cur ? cur + sep + text : text;
        }
    }
    if (cur) chunks.push(cur);
    return chunks;
}

/**
 * "/commands": Übersicht Custom Commands, Mod-Commands, Aliase und Zähler eines Kanals.
 * Wie im alten Bot erscheinen nur Bereiche, für die es Daten gibt; ist gar nichts angelegt, steht ein Hinweis da.
 * Ist eine Liste länger als ein Embed-Feld erlaubt (1024 Zeichen), läuft sie in einem Folgefeld ohne Titel weiter.
 */
export function botCommandsEmbed({ botAvatarUrl, everyone, mod, aliases, counters }) {
    const embed = new EmbedBuilder().setColor(COLOR).setTitle("__Bot_Commands:__").setThumbnail(botAvatarUrl);
    const sections = [
        ["Der Bot kann folgende Commands:", everyone, ", "],
        ["Mod-Commands", mod, ", "],
        ["Aliase:", aliases, " | "],
        ["Counter:", counters, ", "],
    ];
    let any = false;
    for (const [name, items, sep] of sections) {
        if (!items?.length) continue;
        any = true;
        chunkItems(items, sep).forEach((value, i) => embed.addFields({ name: i === 0 ? name : "\u200b", value }));
    }
    if (!any) embed.addFields({ name: "Information", value: "Es ist leider kein Command hinterlegt" });
    return embed;
}

/** "/watchtime". */
export function watchtimeEmbed({ botAvatarUrl, monthly, twuser, watchtimeText, percent }) {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setThumbnail(botAvatarUrl)
        .setTitle(monthly ? "**__Watchtime (aktueller Monat)__**" : "**__Watchtime__**")
        .addFields(
            { name: "Nutzername", value: twuser },
            { name: "Watchtime", value: watchtimeText },
            { name: "Von der registrierten Zeit", value: `${percent}%` },
        );
}

/** "/profil": Level, Punkte und Fortschritt zum nächsten Level. */
export function profileEmbed({ avatarUrl, twuser, level, points, percent }) {
    const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
    const bar = "▓".repeat(filled) + "░".repeat(10 - filled);
    return new EmbedBuilder()
        .setColor(COLOR)
        .setThumbnail(avatarUrl)
        .setTitle("**__Nutzer- Profil__**")
        .addFields(
            { name: "Twitch-Name", value: twuser },
            { name: "Level", value: String(level), inline: true },
            { name: "Punkt", value: String(points), inline: true },
            { name: "Bis zum nächsten Level", value: `${bar} ${percent}%` },
        );
}

/** "/top10" (Seite "page" von "rows" = [{viewer, watchtime}]). */
export function top10Embed({ channel, rows, page, formatRow }) {
    const embed = new EmbedBuilder()
        .setTitle("**__Watchtime:__**")
        .setColor(COLOR)
        .setDescription(channel ?? "-")
        .setFooter({ text: `Seite ${page}` });
    for (const r of rows) embed.addFields({ name: r.viewer, value: formatRow(r), inline: false });
    if (!rows.length) embed.addFields({ name: "-", value: "Keine Einträge" });
    return embed;
}

/** "/info": Discord-/Twitch-Verknüpfungsinfo. */
export function linkingInfoEmbed({ avatarUrl, discordName, twitchName, age, followAge }) {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setThumbnail(avatarUrl)
        .setTitle("**__Linkinginfo__**")
        .addFields(
            { name: "Discord-Name", value: discordName },
            { name: "Twitch-Name", value: twitchName },
            { name: "__Der Twitchaccount wurde erstellt vor__", value: age },
            { name: "__Folgt schon__", value: followAge },
        );
}

/** "/zitat": ein Zitat aus dem Zitat-Archiv des Kanals. */
export function quoteEmbed({ channel, quote }) {
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`**__Zitat #${quote.id}__**`)
        .setDescription(`„${quote.text}“`);
    const footer = [channel, quote.created_at ? new Date(quote.created_at).toLocaleDateString("de-DE") : null].filter(Boolean).join(" · ");
    if (footer) embed.setFooter({ text: footer });
    return embed;
}
