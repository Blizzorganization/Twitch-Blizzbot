const { MessageEmbed } = require("discord.js")
function calcWatchtime(watchtime) {
    var timeTotalMinutes = Math.floor(watchtime / 2)
    var timeMinutes = timeTotalMinutes % 60
    var timeHours = (timeTotalMinutes % 1440) - timeMinutes
    var timeDays = (timeTotalMinutes - timeMinutes) - timeHours
    timeHours /= 60
    timeDays /= 1440
    return `${timeDays} Tag(en), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`
}
exports.run = (client, message, args) => {
    if (!args[0]) return message.channel.send("Du musst einen Kananl angeben - folgende sind zur Auswahl:\n`"+client.clients.twitch.getChannels().join("`, `")+ "`")
    const channel = args[0]
    const embed = new MessageEmbed()
        .setTitle("Monthly Watchtime")
        .setColor(0xdfb82d)
        .setDescription(channel)
    const watchtime = client.clients.twitch.db.mwatchtimeList(channel, 10)
    for (const user in watchtime) {
        embed.addField(watchtime[user].user, calcWatchtime(watchtime[user].watchtime), false)
    }
    message.channel.send(embed)
}