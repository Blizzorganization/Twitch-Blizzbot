
exports.event = (client, message) => {
    if (message.author.id == client.user.id) return;
    if (message.author.bot) return;
    let args = message.content.split(" ")
    switch (message.channel.id) {
        case client.config.channels.relay:
            let channel;
            if (client.clients.twitch.config.channels.length == 1) {
                channel = client.clients.twitch.config.channels[0]
            } else {
                channel = args.shift().toLowerCase()
            }
            if (!channel.startsWith("#")) return message.channel.send("Es wurde nicht angegeben, wo die Nachricht gesendet werden soll.")
            client.clients.twitch.say(channel, args.join(" "))
            break;
        case client.config.channels.commands:
            let commandName = args.shift().toLowerCase()
            let cmd = client.commands.get(commandName)
            if (!cmd) return;
            cmd.run(client, message, args);
            break;
        default:
            break;
    }
}
