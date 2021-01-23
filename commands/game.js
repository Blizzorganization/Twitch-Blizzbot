const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
  let resp = await fetch(`https://decapi.me/twitch/game/${target.slice(1)}`)
  let game = await resp.text()
  client.say(target, `Blizzor spielt ${game}.`)
}
