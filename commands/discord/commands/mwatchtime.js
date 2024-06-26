import { EmbedBuilder } from "discord.js";
import { calcWatchtime, currentMonth } from "twitch-blizzbot/functions";

export const adminOnly = true;
/**
 * @name watchtimechannel
 * @namespace DiscordCommands
 * @description displays the watchtime of a user
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    const channel = client.config.watchtimechannel;
    let page = 1;
    if (args && args.length > 0) {
        if (args[0] && !isNaN(parseInt(args[0]))) page = parseInt(args[0]);
    }
    const embed = new EmbedBuilder()
        .setTitle("Monthly Watchtime")
        .setColor(0xedbc5d)
        .setDescription(channel)
        .setFooter({ text: `Seite ${page}` });
    const watchtime = await client.clients.db.watchtimeList(channel, currentMonth(), 10, page);
    for (const viewer in watchtime) {
        embed.addFields({
            name: watchtime[viewer].viewer,
            value: calcWatchtime(watchtime[viewer].watchtime),
            inline: false,
        });
    }
    let outmsg = await message.channel.send({ embeds: [embed] });
    await outmsg.react("⬅️");
    await outmsg.react("➡️");
    const coll = outmsg.createReactionCollector({
        filter: (reaction, user) => user !== client.user && ["⬅️", "➡️"].includes(reaction.emoji.name),
        idle: 30000,
    });
    coll.on("collect", async (reaction) => {
        if (reaction.emoji.name == "➡️") {
            page++;
        } else {
            page = Math.max(--page, 1);
        }
        const editEmbed = new EmbedBuilder()
            .setTitle("Monthly Watchtime")
            .setColor(0xedbc5d)
            .setDescription(channel)
            .setFooter({ text: `Seite ${page}` });
        const newwatchtime = await client.clients.db.watchtimeList(channel, currentMonth(), 10, page);
        for (const viewer in newwatchtime) {
            editEmbed.addFields({
                name: newwatchtime[viewer].viewer,
                value: calcWatchtime(newwatchtime[viewer].watchtime),
                inline: false,
            });
        }
        outmsg = await outmsg.edit({ embeds: [editEmbed] });
        await reaction.remove();
        await outmsg.react(reaction.emoji);
    });
    coll.on("end", async () => {
        await outmsg.edit({ content: "Die Zeit ist abgelaufen.", embeds: outmsg.embeds });
    });
}
