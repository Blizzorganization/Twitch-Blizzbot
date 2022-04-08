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
    if (args.length > 1) {
        const newcmd = args.shift().toLowerCase();
        const res = args.map((arg) => (arg.startsWith("<:") ? arg.split(":")[1] : arg)).join(" ");
        if (!res || res == "") return message.reply({ content: "Du musst angeben, was die Antwort sein soll." });
        await client.clients.db.newCcmd(twchannel, newcmd, res, permissions.user);
        message.reply({ content: `Der Befehl ${newcmd} wurde hinzugefügt.` });
        logger.log("command", `* Added Customcommand ${newcmd}`);
    } else {
        message.reply({ content: "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest." });
    }
}
