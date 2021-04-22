const { calcWatchtime } = require("../../../modules/functions")

exports.help = false
exports.perm = true
/**
 * @name uwtime
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) {
        client.say(target, "Du musst einen Nutzer angeben.")
        return
    }
    let user = args[0].toLowerCase()
    var watchtime = client.db.getWatchtime(target, user)
    if (!watchtime) return client.say(target, "Diesen Nutzer kenne ich nicht.")
    client.say(target, `${user} schaut ${target.slice(1)} schon seit ${calcWatchtime(watchtime)}`)
}