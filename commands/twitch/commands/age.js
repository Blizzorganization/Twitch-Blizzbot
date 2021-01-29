const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
  let resp = await fetch(`https://decapi.me/twitch/accountage/${context["display-name"]}`)
//  let accountage = await resp.text()
  let age = await resp.text()
  age = age.replace("years", "Jahre").replace("year", "Jahr").replace("months", "Monate").replace("month", "Monat").replace("weeks", "Wochen").replace("week", "Woche")
  client.say(target, `Der Account wurde vor ${age} erstellt.`)
}
