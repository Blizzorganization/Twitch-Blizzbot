const fetch = require("node-fetch")

exports.help = true
exports.alias = ["alter"]
/**
 * @name age
 * @module TwitchCommands
 * @param {TwitchClient} client 
 * @param {string} target 
 * @param {ChatUserstate} context 
 * @param {string} msg 
 * @param {boolean} self 
 */
exports.run = async (client, target, context, msg, self, args) => {
    let user = args[0]
    if (!user || user=="") user=context["display-name"]
    let resp = await fetch(`https://decapi.me/twitch/accountage/${user}`)
    let age = (await resp.text())
        .replace("years", "Jahren").replace("year", "Jahr")
        .replace("months", "Monaten").replace("month", "Monat")
        .replace("weeks", "Wochen").replace("week", "Woche")
        .replace("days", "Tage").replace("day", "Tag")
        .replace("hours", "Stunden").replace("hour", "Stunde")
        .replace("minutes", "Minuten").replace("minute", "Minute")
        .replace("seconds", "Sekunden").replace("second", "Sekunde")

    client.say(target, `${user} dein Account wurde vor ${age} erstellt.`)
}