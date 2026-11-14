import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { config } from "../config.js";
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

/** Schickt die Blacklist in den Discord-Blacklist-Kanal (wie !blacklist im alten Bot). */
export async function sendBlacklist(channel) {
    const id = config.discord.blacklistChannelId;
    if (!getClient() || !id) throw new Error("Discord-Blacklist-Kanal ist nicht konfiguriert");
    const target = await getClient().channels.fetch(id);
    if (!target?.isTextBased()) throw new Error("DISCORD_BLACKLIST_CHANNEL_ID ist kein Textkanal");
    await target.send(await blacklistPayload(channel));
}
