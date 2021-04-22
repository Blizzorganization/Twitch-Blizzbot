exports.help = false
exports.perm = true
/**
 * @name edit
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run =(client, target, context, msg, self, args) => {
    if (!args) return client.say(target, "Welchen Befehl möchtest du bearbeiten?")
    if (args.length > 1) {
        let newcmd = args.shift().toLowerCase()
        let res = args.join(" ")
        client.db.editCcmd(newcmd, res)
        client.say(target, `Befehl ${newcmd} wurde bearbeitet.`)
        console.log(`* Edited Customcommand ${newcmd}`)
    }
}