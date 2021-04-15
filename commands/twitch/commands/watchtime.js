exports.help = true
exports.run = async (client, target, context, msg, self) => {
    var watchtime = client.db.getWatchtime(target, context["username"])
    if (!watchtime) watchtime = 1
    var timeTotalMinutes = Math.floor(watchtime / 2)
    var timeMinutes = timeTotalMinutes % 60
    var timeHours = (timeTotalMinutes % 1440) - timeMinutes
    var timeDays = (timeTotalMinutes - timeMinutes) - timeHours
    timeHours /= 60
    timeDays /= 1440
    client.say(target, `${context["display-name"]} schaut ${target.slice(1)} schon seit ${timeDays} Tag(e), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`)
}