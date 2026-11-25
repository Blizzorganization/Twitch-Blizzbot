import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { discordSettingsFor } from "../db/discord-settings.js";
import { getTable } from "../utils/table.js";
import { listBlacklist } from "../db/blacklist.js";
import { getClient } from "./state.js";

export async function blacklistPayload(channel) {
    const rows = await listBlacklist(channel);
    const table = getTable(rows.map((r) => ({ word: r.word, action: r.action })));
    const row = new ActionRowBuilder().setComponents(
        new ButtonBuilder().setCustomId(`refresh-blacklist:${channel}`).setEmoji("🔄").setStyle(ButtonStyle.Primary),
    );
    return {
        content: `In der Blacklist für ${channel} sind die Wörter \`\`\`fix\n${table.slice(0, 1900)}\`\`\` enthalten.`,
        components: [row],
    };
}

/** Hat der Kanal in den Discord-Einstellungen einen Blacklist-Kanal (und Discord ist für ihn eingeschaltet)? */
export function hasBlacklistChannel(channel) {
    const s = discordSettingsFor(channel);
    return !!(s?.enabled && s.blacklistChannelId);
}

/** Schickt die Blacklist in den Discord-Blacklist-Kanal des Twitch-Kanals (wie !blacklist im alten Bot). */
export async function sendBlacklist(channel) {
    const s = discordSettingsFor(channel);
    const id = s?.enabled ? s.blacklistChannelId : "";
    if (!getClient() || !id) throw new Error("Für diesen Kanal ist kein Discord-Blacklist-Kanal eingerichtet");
    const target = await getClient().channels.fetch(id);
    if (!target?.isTextBased()) throw new Error("Der eingetragene Blacklist-Kanal ist kein Textkanal");
    await target.send(await blacklistPayload(channel));
}
