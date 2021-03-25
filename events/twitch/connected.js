const fetch = require("node-fetch")
module.exports = (client, addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
    if (client.clients.discord) if (client.clients.discord.started) client.clients.discord.statuschannel.send("Bot wurde gestartet.")
    client.started = true
    setInterval(() => {
        client.config.channels.forEach(async (channel) => {
            let uptime = await (await fetch(`https://decapi.me/twitch/uptime/${channel.slice(1)}`)).text()
            if (`#${uptime}` !== `${channel} is offline`) {
                let active = (await (await fetch(`http://tmi.twitch.tv/group/user/${channel.slice(1)}/chatters`)).json()).chatters
                Object.values(active).forEach((viewers) => {
                    viewers.forEach((viewer) => {
                        client.watchtime.ensure(channel, 0, viewer)
                        client.watchtime.inc(channel, viewer)
                    })
                })
            }
        });
    }, 30000);
}