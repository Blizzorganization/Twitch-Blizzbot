const { MessageEmbed } = require("discord.js")
const { calcWatchtime } = require("../../modules/functions")

/**
 * @name watchtimelb
 * @module DiscordCommands
 * @param {DiscordClient} client 
 * @param {Message} message 
 * @param {string[]} args 
 * @returns {Message|undefined}
 */
exports.adminOnly = false
exports.run = (client, message, args) => {
    let channel = client.config.watchtimechannel;
    const embed = new MessageEmbed()
        .setTitle("Watchtime")
        .setColor(0xdfb82d)
        .setDescription(channel)
    const watchtime = client.clients.twitch.db.watchtimeList(channel, 10)
    for (const user in watchtime) {
        embed.addField(watchtime[user].user, calcWatchtime(watchtime[user].watchtime), false)
    }
    message.channel.send(embed)
}