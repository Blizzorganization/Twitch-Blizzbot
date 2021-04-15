exports.run = (client, message, args) => {
    if (!args || args.lenth == 0) return message.channel.send("Du musst angeben, was du von der Blacklist entfernen willst!")
    let blremove = args.join(" ").toLowerCase()
    if (!client.clients.twitch.blacklist.includes("delmsg", blremove)) return message.channel.send(`"${blremove}" wird nicht gelöscht, kann also auch nicht aus der Blacklist entfernt werden.`)
    client.clients.twitch.blacklist.remove("delmsg", blremove)
    message.channel.send(`"${blremove}" wurde von der Blacklist entfernt`)
    console.log(`* Removed "${blremove}" from Blacklist`)
}
