exports.help = false
exports.perm = true
exports.run =(client, target, context, msg, self, args) => {
    if (!args || args.length == 0) return client.say(target, "Du musst angeben, was du von der Blacklist entfernen willst!")
    let blremove = args.join(" ").toLowerCase()
    let blacklist = client.blacklist.get("delmsg")
    if (!blacklist.includes(blremove)) return client.say(target, `"${blremove}" wird nicht gelöscht, kann also auch nicht aus der Blacklist entfernt werden.`)
    client.blacklist.remove("delmsg", blremove)
    client.say(target, `"${blremove}" wurde von der Blacklist entfernt`)
    console.log(`* Removed "${blremove}" from Blacklist`)
}