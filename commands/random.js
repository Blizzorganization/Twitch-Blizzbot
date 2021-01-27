const fetch = require("node-fetch")
exports.help = false
exports.run = async (client, target, context, msg, self) => {
  let resp = await fetch(`https://decapi.me/twitch/random_user/${target.slice(1)}`)
  let random = await resp.text()
  client.say(target, ` ${random} ist aktiver als Reyana im Chat`)
}
