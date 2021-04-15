exports.help = false
exports.perm = true
exports.run =(client, target, context, msg, self, args) => {
    if (args.length > 1) {
        let newcmd = args.shift().toLowerCase()
        let res = args.join(" ")
        if (!res || res == "") return client.say(target, "Du musst angeben, was die Antwort sein soll.")
        client.db.newCcmd(newcmd, res)
        client.say(target, `Befehl ${newcmd} wurde hinzugefügt.`)
        console.log(`* Added Customcommand ${newcmd}`)
    } else {
        client.say(target, "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest.")
    }
}