exports.run = (client, message, args) => {
    if (!args || args.lenth == 0) return message.channel.send("Du musst angeben, was du blockieren willst!")
    let blword = args.join(" ").toLowerCase()
    client.clients.twitch.blacklist.push("delmsg", blword)
    message.channel.send(`"${blword}" wurde in die Blacklist eingetragen ;3`)
    console.log(`* Added "${blword}" to Blacklist`)
}