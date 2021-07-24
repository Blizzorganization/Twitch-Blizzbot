const { Message } = require("discord.js")
const fs = require("fs")
const os = require("os")
const util = require("util")
const { DiscordClient } = require("../../../modules/discordclient")

/**
 * @name eval
 * @module DiscordCommands
 * @param {DiscordClient} client 
 * @param {Message} message 
 * @param {string[]} args 
 */
exports.adminOnly = false
exports.run = async (client, message, args) => {
    if (!args || !args[0]) {
        var msg = await message.channel.send("Du musst deinen Twitch Nutzernamen angeben.")
        var coll = msg.channel.createMessageCollector((m => m.author.id == message.author.id))
        coll.on("collect", (m) => {
            coll.stop();
            if (m.content.startsWith(`${client.config.prefix}`)) return;
            
            handle(client, m, m.content.split(" "))
        })
    } else {
    handle(client, message, args)}
}
function handle(client, message, args) {
    if (!(/^[a-zA-Z0-9][\w]{2,24}$/.test(args[0]))) return message.channel.send("Dies ist kein valider Twitch Nutzername.");
    client.clients.twitch.db.newDiscordConnection(message.author, args[0].toLowerCase());
    message.channel.send("Dein Name wurde erfolgreich eingetragen.")
}