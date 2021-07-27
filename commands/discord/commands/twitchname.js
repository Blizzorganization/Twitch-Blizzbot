const { MessageEmbed } = require("discord.js")

/**
 * @name tname
 * @module DiscordCommands
 * @param {DiscordClient} client
 * @param {Message} message
 * @param {string[]} args
 */
exports.adminOnly = false
exports.run = (client, message, args) => {

    var dbuser = client.clients.twitch.db.getDiscordConnection(message.author)
    if (!dbuser) dbuser = "Du hast keinen Namen hinterlegt"

    var embed = new MessageEmbed()
        .setColor(0xdfb82d)
        .setThumbnail(url = message.author.avatarURL())
        .setTitle("**__Linkinginfo__**")
        .addField("Discord-name", message.author.username)
        .addField("Twitch-name", dbuser)

    message.channel.send(embed)
}
