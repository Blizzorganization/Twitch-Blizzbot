import { EmbedBuilder } from "discord.js";
import { logger } from "twitch-blizzbot/logger";

export const adminOnly = true;
export const alias = ["view"];
/**
 * @name Showcommands
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
export async function run(client, message, args) {
    const twChannel = client.config.watchtimechannel;
    if (args.length < 1) {
        message.reply("Du musst einen Command angeben.");
        return;
    }
    let commandName = args.shift();
    if (commandName.startsWith("!")) commandName = commandName.replace("!", "");
    const ccmd = await client.clients.db.getCcmd(twChannel, `!${commandName}`);
    if (!ccmd) {
        message.reply("Einen solchen Command gibt es nicht.");
        return;
    }
    message.reply({ content: ccmd.response, embeds: [new EmbedBuilder().setDescription("CCMD")] });
    logger.log("command", `* Viewed Command !${commandName}`);
}
