exports.run = async (client, message, args) => {
    if (!args || !args[0]) {
        var msg = await message.channel.send("Du musst deinen Twitch Nutzernamen angeben.")
        var coll = msg.channel.createMessageCollector((m => m.author.id == message.author.id))
        coll.on("collect", (m) => {
            coll.stop();
            if (m.content.startsWith(`${client.config.prefix}`)) return;
            
            handle(client, m, m.content.split(" "))
        })
    }
    handle(client, message, args)
}
function handle(client, message, args) {
    if (!(/^[a-zA-Z0-9][\w]{2,24}$/.test(args[0]))) return message.channel.send("Dies ist kein valider Twitch Nutzername.");
    client.clients.twitch.db.newDiscordConnection(message.author, args[0].toLowerCase());
    message.channel.send("Dein Name wurde erfolgreich eingetragen.")
}