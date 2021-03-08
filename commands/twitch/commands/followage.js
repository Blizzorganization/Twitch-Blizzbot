const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
    let resp = await fetch(`https://2g.be/twitch/following.php?user=${context["display-name"]}&channel=${target.slice(1)}&format=mwdhms`)
    let followage = await resp.text()
    followage = followage.replace("years", "Jahre").replace("year", "Jahr").replace("months", "Monate").replace("month", "Monat").replace("weeks", "Wochen").replace("week", "Woche").replace("days", "Tage").replace("day", "Tag").replace("hours", "Stunden").replace("hour", "Stunde").replace("minutes", "Minuten").replace("minute", "Minute").replace("seconds", "Sekunden").replace("second", "Sekunde")
    followage = followage.replace("has been following", "folgt").replace("for", "seit")
    client.say(target, followage)
}