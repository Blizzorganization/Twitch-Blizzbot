import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;
/**
 * @name deleteblacklist
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    if (!args || args.length == 0) {
        await message.channel.send("Du musst angeben, was du von der Blacklist entfernen willst!");
        return;
    }
    const blremove = args.join(" ").toLowerCase();
    const blacklist = client.clients.twitch.blacklist[client.config.watchtimechannel];
    const blacklistEntry = blacklist.find((entry) => entry.blword == blremove);
    if (!blacklist) {
        await message.channel.send({
            content: `"${blremove}" ist in keiner Blacklist vorhanden, kann also auch nicht aus der Blacklist entfernt werden.`,
        });
        return;
    }
    client.clients.twitch.blacklist[client.config.watchtimechannel] = blacklist.filter((b) => b !== blacklistEntry);
    await client.clients.db.removeBlacklistWord(client.config.watchtimechannel, blremove);
    await message.channel.send(
        `"${blremove}" wurde von der Blacklist vom Channel ${client.config.watchtimechannel} entfernt`,
    );
    logger.info(`* Removed "${blremove}" from Blacklist of ${client.config.watchtimechannel}`);
}
