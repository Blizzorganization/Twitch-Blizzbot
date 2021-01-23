const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
  let resp = await fetch(`https://2g.be/twitch/following.php?user=${context["display-name"]}&channel=${target.slice(1)}&format=mwdhms`)
  let followage = await resp.text()
  client.say(target, followage)
}
