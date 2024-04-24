import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;

/**
 * @name deleteCcmd
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (args.length == 0) {
        await message.reply({ content: "Du musst einen Befehl angeben, der gelöscht werden soll." });
        return;
    }
    const cmd = await client.clients.db.getCcmd(twchannel, args[0]);
    if (!cmd) {
        await message.reply({ content: `Ich kenne keinen Befehl ${args[0]}.` });
        return;
    }
    if (cmd.permissions !== permissions.user) {
        await message.reply({ content: `${args[0]} ist kein Nutzer Customcommand.` });
        return;
    }
    await client.clients.db.delCcmd(twchannel, args[0]);
    await message.reply({ content: `Der Command ${args[0]} wurde entfernt.` });
    logger.info(`* Deleted Customcommand ${args[0]}`);
}
