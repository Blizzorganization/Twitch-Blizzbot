const fetch = require("node-fetch")
exports.help = true
exports.run = async (client, target, context, msg, self) => {
    let uptimerequest = await fetch(`https://decapi.me/twitch/uptime/${target.slice(1)}`)
    let uptime = await uptimerequest.text()
    uptime = uptime.replace("hours", "Stunden").replace("hour", "Stunde").replace("minutes", "Minuten").replace("minute", "Minute").replace("seconds", "Sekunden").replace("second", "Sekunde")
    if (uptime == `${target.slice(1)} is offline`) {
        client.say(target, `${target.slice(1)} ist offline.`)
    } else {
        client.say(target, `${target.slice(1)} ist seit ${uptime} live. blizzo2Logo `)
    }
}

