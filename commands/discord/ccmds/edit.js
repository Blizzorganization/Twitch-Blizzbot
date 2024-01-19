import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;

/**
 * @name editCcmd
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (!args || args.length == 0) {
        await message.channel.send({ content: "Welchen Befehl möchtest du bearbeiten?" });
        return;
    }
    const cmd = await client.clients.db.getCcmd(twchannel, args[0]);
    if (!cmd) {
        await message.channel.send({ content: `Ich kenne keinen Befehl ${args[0]}.` });
        return;
    }
    if (cmd.permissions !== permissions.user) {
        await message.reply({ content: `${args[0]} ist kein Nutzer Customcommand.` });
        return;
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.map((arg) => (arg.startsWith("<:") ? arg.split(":")[1] : arg)).join(" ");
    await client.clients.db.editCcmd(twchannel, newcmd, res);
    await message.reply({ content: `Der Command ${newcmd} wurde editiert.` });
    logger.log("command", `* Edited Customcommand ${newcmd}`);
}
