exports.help = false
exports.perm = true
/**
 * @name addalias
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run =(client, target, context, msg, self, args) => {
    if (args.length > 1) {
        let newcmd = args.shift().toLowerCase()
        let res = args.join(" ")
        if (!res || res == "") return client.say(target, "Du musst angeben, worauf der Alias verknüpft sein soll.")
        if (!client.db.getCcmd(res)) return client.say(target, "Diesen Befehl kenne ich nicht.")
        client.db.newAlias(newcmd, res)
        client.say(target, `Alias ${newcmd} für ${res} wurde hinzugefügt.`)
        console.log(`* Added Alias ${newcmd} for Customcommand ${res}`)
    } else {
        client.say(target, "Du musst angeben, welchen Alias und welchen Befehl du verwenden möchtest.")
    }
}