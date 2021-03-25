exports.help = false
exports.perm = true
exports.run = (client, target, context, msg, self, args) => {
    if (!args || args.length==0) {
        client.say(target, "Du musst einen Nutzer angeben.")
        return
    }
    let user = args[0].toLowerCase()
    var watchtime = client.watchtime.get(target, user)
    if (!watchtime) return client.say(target, "Diesen Nutzer kenne ich nicht.")
    var timeTotalMinutes = Math.floor(watchtime/2)
    var timeMinutes = timeTotalMinutes%60
    var timeHours = (timeTotalMinutes%1440)-timeMinutes
    var timeDays = (timeTotalMinutes-timeMinutes)-timeHours
    timeHours /= 60
    client.say(target, `${user} schaut ${target.slice(1)} schon seit ${timeDays} Tag(en), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`)
}
