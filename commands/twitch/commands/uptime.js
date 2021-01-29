const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
  let uptimerequest = await fetch("https://decapi.me/twitch/uptime/blizzor96")
  let uptime = await uptimerequest.text()
  uptime = uptime.replace("hours", "Stunden").replace("hour", "Stunde").replace("minutes", "Minuten").replace("minute", "Minute").replace("seconds", "Sekunden").replace("second", "Sekunde")
  if (uptime == "blizzor96 is offline") {
    client.say(target, "Blizzor ist offline.")
  } else {
    client.say(target, `Blizzor ist seit ${uptime} live. blizzo2Logo `)
  }
}
