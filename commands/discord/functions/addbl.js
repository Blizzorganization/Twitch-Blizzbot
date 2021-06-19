const { Message } = require("discord.js")
const { DiscordClient } = require("../../../modules/discordclient")

/**
 * @name addbl
 * @module DiscordCommands
 * @param {DiscordClient} client 
 * @param {Message} message 
 * @param {string[]} args 
 */
exports.adminOnly = true
exports.run = (client, message, args) => {
    if (!args || args.length == 0) return message.channel.send("Du musst angeben, was du blockieren willst!")
    let blword = args.join(" ").toLowerCase()
    client.clients.twitch.blacklist.push("delmsg", blword, undefined, true)
    message.channel.send(`"${blword}" wurde in die Blacklist eingetragen ;3`)
    console.log(`* Added "${blword}" to Blacklist`)
}