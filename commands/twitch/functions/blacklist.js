import { MessageActionRow, MessageButton } from "discord.js";
import { permissions } from "twitch-blizzbot/constants";
import { getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
export const silent = true;
/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 */
export async function run(client, target, context) {
    const user = context["display-name"];
    client.clients.discord.blchannel.send({
        content: `In der Blacklist für ${target} sind die Wörter \
        \`\`\`fix\n${getTable(client.blacklist[target.replace(/#+/g, "")])}\`\`\` enthalten.`,
        components: [
            new MessageActionRow().setComponents(
                new MessageButton().setCustomId("refresh-blacklist").setEmoji("🔄").setStyle("PRIMARY"),
            ),
        ],
    });
    client.say(target, `${user} Blacklist wurde gesendet`);
    logger.info(`* Sent the blacklist of ${target} to ${context.username}`);
}
