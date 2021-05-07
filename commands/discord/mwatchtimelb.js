const { MessageEmbed, Message } = require("discord.js")
const { calcWatchtime } = require("../../modules/functions")
/**
 * @name mwatchtimelb
 * @module DiscordCommands
 * @description sends top 10 monthly watchers
 * @param {DiscordClient} client 
 * @param {Message} message 
 * @param {string[]} args 
 */
exports.adminOnly = true
exports.run = (client, message, args) => {
    if (!args[0]) return message.channel.send("Du musst einen Kananl angeben - folgende sind zur Auswahl:\n`" + client.clients.twitch.getChannels().join("`, `") + "`")
    const channel = args[0]
    const embed = new MessageEmbed()
        .setTitle("Monthly Watchtime")
        .setColor(0xdfb82d)
        .setDescription(channel)
    const watchtime = client.clients.twitch.db.mwatchtimeList(channel, 10)
    for (const user in watchtime) {
        embed.addField(watchtime[user].user, calcWatchtime(watchtime[user].watchtime), false)
    }
    message.channel.send(embed)
}