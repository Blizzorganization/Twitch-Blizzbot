exports.help = false
exports.perm = true
/**
 * @name delalias
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run =(client, target, context, msg, self, args) => {
    if (args.length == 0) return
    client.db.delAlias(args[0])
    client.say(target, `Alias ${args[0]} wurde entfernt.`)
    console.log(`* Deleted alias ${args[0]}`)
}