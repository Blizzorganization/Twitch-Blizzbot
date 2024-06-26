import { ButtonStyle } from "discord.js";
import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { getTable } from "twitch-blizzbot/functions";

export const adminOnly = true;
/**
 * @name blacklist
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @returns {Promise<void>}
 */
export async function run(client) {
    /** @type {ActionRowBuilder<ButtonBuilder>} */
    const row = new ActionRowBuilder();
    row.setComponents(
        new ButtonBuilder().setCustomId("refresh-blacklist").setEmoji("🔄").setStyle(ButtonStyle.Primary),
    );
    await client.blchannel.send({
        content: `\`\`\`fix\n${getTable(
            client.clients.twitch.blacklist[client.config.watchtimechannel].map((blEntry) => ({
                word: blEntry.blword,
                action: blEntry.action,
            })),
        ).slice(0, 1990)}\`\`\``,
        components: [row],
    });
}
