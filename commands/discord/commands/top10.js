import { EmbedBuilder } from "discord.js";
import { calcWatchtime } from "twitch-blizzbot/functions";

export const adminOnly = false;
/**
 * @name watchtimechannel
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
export async function run(client, message, args) {
    const channel = client.config.watchtimechannel;
    let page = 1;
    if (args && args.length > 0) {
        if (args[0] && !isNaN(parseInt(args[0]))) page = parseInt(args[0]);
    }
    const embed = new EmbedBuilder()
        .setTitle("**__Watchtime:__**")
        .setColor(0xedbc5d)
        .setDescription(channel)
        .setFooter({ text: `Seite ${page}` });
    const watchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
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
        idle: 60000,
    });
    coll.on("collect", async (reaction, user) => {
        if (user.id == client.user.id) return;
        if (reaction.emoji.name == "➡️") {
            page++;
        } else {
            page = Math.max(--page, 1);
        }
        const editEmbed = new EmbedBuilder()
            .setTitle("**__Watchtime:__**")
            .setColor(0xedbc5d)
            .setFooter({ text: `Seite ${page}` })
            .setDescription(channel);
        const newwatchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
        for (const viewer in newwatchtime) {
            editEmbed.addFields({
                name: newwatchtime[viewer].viewer,
                value: calcWatchtime(newwatchtime[viewer].watchtime),
                inline: false,
            });
        }
        outmsg = await outmsg.edit({ embeds: [editEmbed] });
        await reaction.remove();
        await outmsg.react(reaction.emoji.name);
    });
    coll.on("end", () => {
        outmsg.edit({
            content: "Die Zeit ist abgelaufen, wenn du erneut abfragen möchtest, so frage erneut an.",
            embeds: outmsg.embeds,
        });
    });
}
