const fetch = require("node-fetch")

exports.help = true
exports.run = async (client, target, context, msg, self) => {
    let resp = await fetch(`https://decapi.me/twitch/accountage/${context["display-name"]}`)
    let age = (await resp.text())
        .replace("years", "Jahren").replace("year", "Jahr")
        .replace("months", "Monaten").replace("month", "Monat")
        .replace("weeks", "Wochen").replace("week", "Woche")
        .replace("days", "Tage").replace("day", "Tag")
        .replace("hours", "Stunden").replace("hour", "Stunde")
        .replace("minutes", "Minuten").replace("minute", "Minute")
        .replace("seconds", "Sekunden").replace("second", "Sekunde")
    client.say(target, `Der Account wurde vor ${age} erstellt.`)
}
