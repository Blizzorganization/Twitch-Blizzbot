module.exports = (client, addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
    if (client.clients.discord) if (client.clients.discord.started) client.clients.discord.statuschannel.send("Bot wurde gestartet.")
    client.started = true
}