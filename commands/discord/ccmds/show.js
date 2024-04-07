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
        await message.reply("Du musst einen Command angeben.");
        return;
    }
    let commandName = args.shift();
    if (commandName.startsWith("!")) commandName = commandName.replace("!", "");
    const ccmd = await client.clients.db.getCcmd(twChannel, `!${commandName}`);
    if (!ccmd) {
        const alias = await client.clients.db.resolveAlias(twChannel, `!${commandName}`);
        if (alias) {
            await message.reply(`Der Command !${commandName} ist ein Alias von ${alias.command}.`);
            return;
        }
        await message.reply("Einen solchen Command gibt es nicht.");
        return;
    }
    const aliases = await client.clients.db.findRelatedAliases(twChannel, `!${commandName}`);

    // embed building
    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ extension: "png" }))
        .setTitle("**__Command-Info:__**");

    // embed components
    embed.addFields([{ name: `!${commandName}`, value: ccmd.response }]);
    embed.addFields({
        name: "Aliase:",
        value: new Intl.ListFormat("de-DE").format(aliases) || "Es sind keine Aliase zu diesem Befehl vorhanden",
    });
    embed.setFooter({ text: "CCMD" });

    await message.channel.send({ embeds: [embed] });
    logger.info(`* Viewed Command !${commandName}`);
}
