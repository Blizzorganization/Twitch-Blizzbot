const { calcWatchtime } = require("../../../modules/functions")

exports.help = true
/**
 * @name watchtime
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self) => {
    var watchtime = client.db.getWatchtime(target, context["username"])
    if (!watchtime) watchtime = 1

    client.say(target, `${context["display-name"]} schaut ${target.slice(1)} schon seit ${calcWatchtime(watchtime)}`)
}