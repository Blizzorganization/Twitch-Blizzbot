import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;
/**
 * @name addblacklist
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    if (!args || args.length == 0) {
        await message.channel.send({ content: "Du musst angeben, was du blockieren willst!" });
        return;
    }
    let action = parseInt(args.shift());
    if (isNaN(action)) action = 0;
    const blword = args.join(" ").toLowerCase();
    client.clients.twitch.blacklist[client.config.watchtimechannel]?.push({
        blword,
        action,
        channel: client.config.watchtimechannel,
    });
    await client.clients.db.newBlacklistWord(client.config.watchtimechannel, blword, action);
    await message.channel.send(
        `"${blword}" wurde in die "${action}" Blacklist von ${client.config.watchtimechannel} eingetragen.`,
    );
    logger.info(`* Added "${blword}" to the ${action} Blacklist of ${client.config.watchtimechannel}`);
}
