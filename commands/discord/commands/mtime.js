const { calcWatchtime, currentMonth } = require("twitch-blizzbot/functions");
const { MessageEmbed } = require("discord.js");

exports.adminOnly = true;
/**
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
exports.run = async (client, message, args) => {
    let user = "";
    if (!args || args.length == 0) {
        const dbuser = await client.clients.db.getDiscordConnection(message.author);
        if (dbuser) {
            user = dbuser;
        } else {
            message.channel.send("Du musst einen Nutzer angeben.");
            return;
        }
    }
    const channel = client.config.watchtimechannel;
    while (args.length > 0 && user == "") {
        if (user == "") {
            user = args.shift().toLowerCase();
        }
    }
    if (user == "") return message.channel.send("Du musst angeben, für welchen Account du die Watchtime abfragen möchtest.");
    const watchtime = await client.clients.db.getWatchtime(channel, user, currentMonth());
    const maxWatchtime = await client.clients.db.getWatchtime(channel, client.clients.twitch.getUsername(), currentMonth());
    if (!watchtime) return message.channel.send("Diesen Nutzer kenne ich nicht.");
    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ format: "png" }))
        .setTitle("**__Monthly Watchtime__**")
        .addField("Nutzername", user)
        .addField("Watchtime", calcWatchtime(watchtime))
        .addField("Von der registrierten Zeit", `${Math.round(1000 * watchtime / maxWatchtime) / 10}%`);

    message.channel.send({ embeds: [embed] });
};