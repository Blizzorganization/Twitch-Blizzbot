/**
 * @name blacklist
 * @module DiscordCommands
 * @param {DiscordClient} client 
 * @param {Message} message 
 * @param {string[]} args 
 */
exports.adminOnly = true
exports.run = (client, message, args) => {
    message.channel.send("```fix\n" + client.clients.twitch.blacklist.get("delmsg").join("\n") + "```", {
        split:
            { append: "```", prepend: "```fix\n" }
    })
}