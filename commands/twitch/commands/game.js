const fetch = require("node-fetch");
exports.help = true
/**
 * @name game
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self) => {
    let resp = await fetch(`https://decapi.me/twitch/game/${target.slice(1)}`)
    let game = await resp.text()
    client.say(target, `Er spielt gerade ${game}.`)
}
