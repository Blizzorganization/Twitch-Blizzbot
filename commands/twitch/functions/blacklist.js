import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { permissions } from "twitch-blizzbot/constants";
import { getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
export const silent = true;
/**
 * @name blacklist
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 */
export async function run(client, target, context) {
    const user = context["display-name"];
    const table = getTable(
        client.blacklist[target.replace(/#+/g, "")].map((blEntry) => ({
            word: blEntry.blword,
            action: blEntry.action,
        })),
    );
    /** @type {ActionRowBuilder<ButtonBuilder>} */
    const row = new ActionRowBuilder();
    row.setComponents(
        new ButtonBuilder().setCustomId("refresh-blacklist").setEmoji("🔄").setStyle(ButtonStyle.Primary),
    );
    await client.clients.discord.blchannel.send({
        content: `In der Blacklist für ${target} sind die Wörter \
        \`\`\`fix\n${table.slice(0, 1990)}\`\`\` enthalten.`,
        components: [row],
    });
    await client.say(target, `${user} Blacklist wurde gesendet`);
    logger.info(`* Sent the blacklist of ${target} to ${context.username}`);
}
