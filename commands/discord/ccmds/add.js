import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;
/**
 * @name addCcmd
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (args.length <= 1) {
        await message.reply({ content: "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest." });
        return;
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.map((arg) => (arg.startsWith("<:") ? arg.split(":")[1] : arg)).join(" ");
    if (!res || res == "") return message.reply({ content: "Du musst angeben, was die Antwort sein soll." });
    const existingCmd = await client.clients.db.getCcmd(twchannel.replace(/#+/g, ""), newcmd);
    if (existingCmd) {
        await message.reply({ content: `Der Command existiert bereits` });
        return;
    }
    await client.clients.db.newCcmd(twchannel, newcmd, res, permissions.user);
    await message.reply({ content: `Der Command ${newcmd} wurde hinzugefügt.` });
    logger.log("command", `* Added Customcommand ${newcmd}`);
}
