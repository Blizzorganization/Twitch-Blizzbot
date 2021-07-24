const fetch = require("node-fetch");

exports.help = true
exports.alias = ["titel"]

/**
 * @name title
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self) => {
    let resp = await fetch(`https://decapi.me/twitch/title/${target.slice(1)}`)
    let title = await resp.text()

    client.say(target, `Der Titel des Streams lautet: ${title}`)
}