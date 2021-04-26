exports.help = false
exports.perm = true
/**
 * @name raid
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = (client, target, context, msg, self) => {
    let minutes = client.config.Raidminutes
    setTimeout(ende, 60000 * minutes)

    client.say(target, `/me Der Follower Modus wurde für die nächsten ${minutes} Minuten deaktiviert.`)
    client.say(target, `/followersoff`)
    /**
     * starts follower only mode after timeout
     */
    function ende() {
        client.say(target, `/followers 0`)
        client.say(target, `/me Der Follower Modus wurde Aktiviert.`)
    }
}