import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;
/**
 * @name deleteAlias
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (args.length == 0) return;
    const alias = await client.clients.db.resolveAlias(twchannel, args[0]);
    if (!alias) {
        await message.reply({ content: `Ich kenne keinen Alias ${args[0]}.` });
        return;
    }

    await client.clients.db.deleteAlias(twchannel, args[0]);
    await message.reply({ content: `Der Alias ${args[0]} wurde entfernt.` });
    logger.info(`* Deleted alias ${args[0]}`);
}
