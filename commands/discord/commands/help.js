const { MessageEmbed } = require("discord.js")
const fs = require("fs")
const os = require("os")
const util = require("util")
const { DiscordClient } = require("../../../modules/discordclient")

exports.adminOnly = false
exports.run = (client, message, args) => {

    var embed = new MessageEmbed()
        .setColor(0xdfb82d)
        .setTitle("**__Der Bot kann folgende Befehle__**")
        .addField("!top10", value="Gibt die aktuellen Top10 der Watchtime liste wieder")
        .addField("!watchtime [Twitch-Name]", value="Gibt die aktuelle watchtime des angegebenen Nutzers wieder")
        .addField("!link [Twitch-Name]", value=" Um deinen Twitchaccount mit Discord zu verbinden so das man nur noch !watchtime eingeben muss")

    message.channel.send(embed)
}
