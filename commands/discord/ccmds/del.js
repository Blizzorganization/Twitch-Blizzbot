import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;

/**
 * @name deleteCcmd
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (args.length == 0) return message.reply({ content: "Du musst einen Befehl angeben, der gelöscht werden soll." });
    const cmd = await client.clients.db.getCcmd(twchannel, args[0]);
    if (!cmd) return message.reply({ content: `Ich kenne keinen Befehl ${args[0]}.` });
    if (cmd.permissions !== permissions.user) {
        return message.reply({ content: `${args[0]} ist kein Nutzer Customcommand.` });
    }
    await client.clients.db.delCcmd(twchannel, args[0]);
    message.reply({ content: `Der Command ${args[0]} wurde entfernt.` });
    logger.log("command", `* Deleted Customcommand ${args[0]}`);
}
