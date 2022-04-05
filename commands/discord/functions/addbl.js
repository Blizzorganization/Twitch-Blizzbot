import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;
/**
 * @name addblacklist
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
export async function run(client, message, args) {
    if (!args || args.length == 0) {
        return message.channel.send({ content: "Du musst angeben, was du blockieren willst!" });
    }
    const action = args.shift();
    const blword = args.join(" ").toLowerCase();
    client.clients.twitch.blacklist[client.config.watchtimechannel][action].push(blword);
    await client.clients.db.saveBlacklist();
    message.channel.send(
        `"${blword}" wurde in die "${action}" Blacklist von ${client.config.watchtimechannel} eingetragen ;3`,
    );
    logger.info(`* Added "${blword}" to the ${action} Blacklist of ${client.config.watchtimechannel}`);
}
