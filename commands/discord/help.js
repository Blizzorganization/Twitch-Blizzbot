const { Message } = require("discord.js")
const fs = require("fs")
const os = require("os")
const util = require("util")
const { DiscordClient } = require("../../modules/discordclient")

exports.adminOnly = false
exports.run = (client, message, args) => {
    message.channel.send("**__Der Bot kann folgende Befehle__**\n```!top10 Zeigt die Aktuelle Top10 der Watchtime an.\n!watchtime (Twitchname) Zeigt die Watchtime von diesem Nutzer an.```")
}
