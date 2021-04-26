exports.help = false
exports.perm = true
/**
 * @name uptime
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run =(client, target, context, msg, self, args) => {
    if (args.length == 0) return
    client.db.delCcmd(args[0])
    client.say(target, `Befehl ${args[0]} wurde gelöscht.`)
    console.log(`* Deleted Customcommand ${args[0]}`)
}