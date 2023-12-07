import { MessageEmbed } from "discord.js";
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
    const aliases = await client.clients.db.findRelatedAliases(twChannel, `!${commandName}`);

    // embed building
    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ format: "png" }))
        .setTitle("**__Command-Info:__**");

    // embed components
    embed.addFields([{ name: `!${commandName}`, value: ccmd.response }]);
    // @ts-ignore
    embed.addFields({
        name: "Aliase:",
        value: new Intl.ListFormat("de-DE").format(aliases) || "Es sind keine Aliase zu diesem Befehl vorhanden",
    });
    embed.setFooter({ text: "CCMD" });

    message.channel.send({ embeds: [embed] });
    logger.log("command", `* Viewed Command !${commandName}`);
}
