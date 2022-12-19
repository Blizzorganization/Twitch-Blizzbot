import { MessageEmbed } from "discord.js";
import { permissions } from "twitch-blizzbot/constants";

export const adminOnly = true;
export const alias = ["commands"];
/**
 * @name helplist
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 */
export async function run(client, message) {
    const twchannel = client.config.watchtimechannel;
    const ccmds = (await client.clients.db.allCcmds(twchannel)).sort().join(", ");
    const coms = (await client.clients.db.allCcmds(twchannel, permissions.mod)).join(", ");
    const aliases = await client.clients.db.getAliases(twchannel);
    const counters = await client.clients.db.allCounters(twchannel);
    const counternames = counters.map((c) => c.name);
    const mappedAliases = [];
    aliases
        .sort((a, b) => (a.alias > b.alias ? 1 : -1))
        .forEach((commandAlias) => {
            if (!mappedAliases[commandAlias.command]) {
                mappedAliases[commandAlias.command] = [];
            }
            mappedAliases[commandAlias.command].push(commandAlias.alias);
        });
    const mappedStrings = [];
    for (const command in mappedAliases) {
        mappedStrings.push(`${command}= ${mappedAliases[command].join(", ")}`);
    }
    // message.reply({ content: `Der Bot kann folgende Commands: ${ccmds} und folgende Aliase: ${mappedStrings.join(" | ")}` });
    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ format: "png" }))
        .setTitle("**__Bot_Commands:__**");
    if (ccmds.length > 0) embed.addFields([{ name: "Der Bot kann folgende Commands:", value: ccmds }]);
    if (coms.length > 0) embed.addFields([{ name: "Mod-Commands", value: coms }]);
    if (alias.length > 0) embed.addFields([{ name: "Aliase:", value: mappedStrings.join(" | ") }]);
    if (counternames.length > 0) embed.addFields([{ name: "Counter:", value: counternames.join(", ") }]);
    message.channel.send({ embeds: [embed] });
}
