const { Message } = require("discord.js")
const fs = require("fs")
const os = require("os")
const util = require("util")
const { DiscordClient } = require("../../modules/discordclient")

/**
 * @name eval
 * @module DiscordCommands
 * @param {DiscordClient} client 
 * @param {Message} message 
 * @param {string[]} args 
 */
exports.adminOnly = true
exports.run = (client, message, args) => {
    var permitted = client.config.evalUsers
    if (!permitted.includes(message.author.id)) return;
    var evaled = eval(args.join(" "))
    if (evaled && evaled!=="") message.channel.send(util.inspect(evaled, {depth:1}), {split:true})
}