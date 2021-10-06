const { MessageEmbed } = require("discord.js");
const { calcWatchtime } = require("../../../modules/functions");

exports.adminOnly = false;
/**
 * @name watchtimelb
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
exports.run = async (client, message, args) => {
    const channel = client.config.watchtimechannel;
    let page = 1;
    if (args && args.length > 0) {
        if (args[0] && !isNaN(parseInt(args[0]))) page = parseInt(args[0]);
    }
    const embed = new MessageEmbed()
        .setTitle("Watchtime")
        .setColor(0xdfb82d)
        .setDescription(channel)
        .setFooter("Seite " + page);
    const watchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
    for (const viewer in watchtime) {
        embed.addField(watchtime[viewer].viewer, calcWatchtime(watchtime[viewer].watchtime), false);
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
        const editEmbed = new MessageEmbed()
            .setTitle("Watchtime")
            .setColor(0xdfb82d)
            .setFooter("Seite " + page)
            .setDescription(channel);
        const newwatchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
        for (const viewer in newwatchtime) {
            editEmbed.addField(newwatchtime[viewer].viewer, calcWatchtime(newwatchtime[viewer].watchtime), false);
        }
        outmsg = await outmsg.edit({ embeds: [editEmbed] });
        await reaction.remove();
        await outmsg.react(reaction.emoji.name);
    });
    coll.on("end", () => {
        outmsg.edit({ content: "Die Zeit ist abgelaufen, wenn du erneut abfragen möchtest, so frage erneut an.", embeds: outmsg.embeds });
    });
};