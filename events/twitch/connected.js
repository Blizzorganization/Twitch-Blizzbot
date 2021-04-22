const { flatMap } = require("lodash");
const fetch = require("node-fetch");
const {TwitchClient} = require("../../modules/twitchclient")

/**
 * @listens twitch:connected
 * @param {TwitchClient} client 
 * @param {string} addr 
 * @param {number} port 
 */
exports.event = (client, addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
    if (client.clients.discord) if (client.clients.discord.started) {
        client.clients.discord.statuschannel.send("Bot wurde gestartet.")
        client.clients.discord.statuschannel.setTopic("Bot Online")
    }
    client.started = true
    for (const channel of client.config.channels) {
        client.clients.twitch.db.newWatchtimeChannel(channel)
    }
    client.watchtime = setInterval(() => {
        client.config.channels.forEach(async (channel) => {
            let uptime = await (await fetch(`https://decapi.me/twitch/uptime/${channel.slice(1)}`)).text()
            if (`#${uptime}` !== `${channel} is offline`) {
                let active = (await (await fetch(`http://tmi.twitch.tv/group/user/${channel.slice(1)}/chatters`)).json()).chatters
                Object.values(active).forEach((viewers) => { client.db.watchtime(channel, flatMap(viewers)) })
            }
        });
    }, 30000);
}
