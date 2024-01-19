import { EmbedBuilder } from "discord.js";
import { permissions } from "twitch-blizzbot/constants";

export const adminOnly = true;
/** @type {string[]} */
export const alias = [];
/**
 * @name helplist
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @returns {Promise<void>}
 */
export async function run(client, message) {
    const twchannel = client.config.watchtimechannel;
    const ccmds = (await client.clients.db.allCcmds(twchannel)).sort().join(", ");
    const coms = (await client.clients.db.allCcmds(twchannel, permissions.mod)).join(", ");

    // Counter Listing
    const counters = await client.clients.db.allCounters(twchannel);
    const counternames = counters.map((c) => c.name);

    // Alias Listing
    const aliases = await client.clients.db.getAliases(twchannel);
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

    // embed building
    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ extension: "png" }))
        .setTitle("**__Bot_Commands:__**");

    // embed components
    if (ccmds.length > 0) embed.addFields([{ name: "Der Bot kann folgende Commands:", value: ccmds }]);
    if (coms.length > 0) embed.addFields([{ name: "Mod-Commands", value: coms }]);
    if (aliases.length > 0) embed.addFields([{ name: "Aliase:", value: mappedStrings.join(" | ") }]);
    if (counternames.length > 0) embed.addFields([{ name: "Counter:", value: counternames.join(", ") }]);
    if (!ccmds.length && !coms.length && !aliases.length && !counternames.length) {
        embed.addFields([{ name: "**Information**", value: "Es ist leider kein Command hinterlegt" }]);
    }

    await message.channel.send({ embeds: [embed] });
}
