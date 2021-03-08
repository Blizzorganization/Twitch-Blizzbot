const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
    let resp = await fetch(`https://decapi.me/twitch/title/${target.slice(1)}`)
    let title = await resp.text()
    client.say(target, `Der Titel des Streams ist ${title}.`)
}
