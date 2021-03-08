module.exports = (client) => {
    client.blchannel = client.channels.resolve(client.config.blchannel)
    client.statuschannel = client.channels.resolve(client.config.statuschannel)
    if (!client.blchannel) return console.log("Fehler: Discord Blacklist Channel wurde nicht gefunden.")
    if (!client.statuschannel) return console.log("Fehler: Discord Status Channel wurde nicht gefunden.")
    if (client.clients.twitch.started && !client.started) client.statuschannel.send("Bot wurde gestartet.")
    client.started = true
}