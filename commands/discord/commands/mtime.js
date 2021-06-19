const { calcWatchtime } = require("../../../modules/functions")
const { MessageEmbed } = require("discord.js")

/**
 * @name uwtime
 * @module DiscordCommands
 * @param {DiscordClient} client
 * @param {Message} message
 * @param {string[]} args
 */
exports.adminOnly = true
exports.run = (client, message, args) => {
    if (!args || args.length == 0) {
        message.channel.send("Du musst einen Nutzer angeben.")
        return
    }
    let user = "";
    let channel = client.config.watchtimechannel;
    while (args.length > 0 && user == "") {
        if (user == "") {
            user = args.shift().toLowerCase();
        }
    }
    if (user == "") return message.channel.send("Du musst angeben, für welchen Account du die Watchtime abfragen möchtest.")
    var mwatchtime = client.clients.twitch.db.getMWatchtime(channel, user)
    if (!mwatchtime) return message.channel.send("Diesen Nutzer kenne ich nicht.")

    var embed = new MessageEmbed()
        .setColor(0xdfb82d).setThumbnail(url = "https://blizzor.de/Twitchbot/blizzbot.png")
        .setTitle("Montly Watchtime")
        .addField("Nutzername", user)
        .addField("Watchtime", calcWatchtime(mwatchtime))

    message.channel.send(embed)
}
