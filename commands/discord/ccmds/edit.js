import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;

/**
 * @name editCcmd
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (!args || args.length == 0) return message.channel.send({ content: "Welchen Befehl möchtest du bearbeiten?" });
    const cmd = await client.clients.db.getCcmd(twchannel, args[0]);
    if (!cmd) return message.channel.send({ content: `Ich kenne keinen Befehl ${args[0]}.` });
    if (cmd.permissions !== permissions.user) {
        return message.reply({ content: `${args[0]} ist kein Nutzer Customcommand.` });
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.join(" ");
    await client.clients.db.editCcmd(twchannel, newcmd, res);
    message.reply({ content: `Der Befehl ${newcmd} wurde bearbeitet.` });
    logger.log("command", `* Edited Customcommand ${newcmd}`);
}
