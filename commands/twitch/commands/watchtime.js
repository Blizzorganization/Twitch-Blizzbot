exports.help = true
exports.run = async (client, target, context, msg, self) => {
    var watchtime = client.watchtime.get(target, context["display-name"])
    if (!watchtime) watchtime = 1
    var timeTotalMinutes = Math.floor(watchtime/2)
    var timeMinutes = timeTotalMinutes%60
    var timeHours = (timeTotalMinutes%1440)-timeMinutes
    var timeDays = (timeTotalMinutes-timeMinutes)-timeHours
    timeHours /= 60
    client.say(target, `Du schaust ${target.slice(1)} schon seit ${timeDays} Tag(en), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`)
}