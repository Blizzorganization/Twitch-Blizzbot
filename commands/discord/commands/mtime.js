const { calcWatchtime, currentMonth } = require("../../../modules/functions");
const { MessageEmbed } = require("discord.js");

exports.adminOnly = true;
/**
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
exports.run = async (client, message, args) => {
    let user = "";
    if (!args || args.length == 0) {
        var dbuser = await client.clients.db.getDiscordConnection(message.author);
        if (dbuser) {
            user = dbuser;
        } else {
            message.channel.send("Du musst einen Nutzer angeben.");
            return;
        }
    }
    let channel = client.config.watchtimechannel;
    while (args.length > 0 && user == "") {
        if (user == "") {
            user = args.shift().toLowerCase();
        }
    }
    if (user == "") return message.channel.send("Du musst angeben, für welchen Account du die Watchtime abfragen möchtest.");
    var watchtime = await client.clients.db.getWatchtime(channel, user, currentMonth());
    if (!watchtime) return message.channel.send("Diesen Nutzer kenne ich nicht.");
    var embed = new MessageEmbed()
        .setColor(0xdfb82d)
        .setThumbnail(client.user.avatarURL({ format: "png" }))
        .setTitle("Monthly Watchtime")
        .addField("Nutzername", user)
        .addField("Watchtime", calcWatchtime(watchtime));

    message.channel.send({ embeds: [embed] });
};