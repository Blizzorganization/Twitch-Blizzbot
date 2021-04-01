exports.help = false
exports.perm = true
exports.run = (client, target, context, msg, self, args) => {
    if (!args) return client.say(target, "Welchen Befehl möchtest du bearbeiten?")
    if (args.length > 1) {
        let newcmd = args.shift().toLowerCase()
        let res = args.join(" ")
        client.coms.set(newcmd, res)
        client.say(target, `Befehl ${newcmd} wurde bearbeitet.`)
        console.log(`* Edited Customcommand ${newcmd}`)
    }
}
