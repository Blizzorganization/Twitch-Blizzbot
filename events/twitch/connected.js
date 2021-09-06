const { flatMap } = require("lodash");
const fetch = require("node-fetch").default;
const { getRandom } = require("../../modules/functions");

/**
 * @listens twitch:connected
 * @param {import("../../modules/twitchclient").TwitchClient} client 
 * @param {string} addr 
 * @param {number} port 
 */
exports.event = (client, addr, port) => {
    client.clients.logger.log("info", `* Connected to ${addr}:${port}`);
    client.started = true;
    for (const channel of client.config.channels) {
        client.clients.db.newChannel(channel);
    }
    client.clients.db.loadBlacklist();
    client.watchtime = setInterval(async () => {
        for (const channel of client.channels) {
            let uptime = await (await fetch(`https://decapi.me/twitch/uptime/${channel.slice(1)}`)).text();
            if (`#${uptime}` !== `${channel} is offline`) {
                let active = (await (await fetch(`http://tmi.twitch.tv/group/user/${channel.slice(1)}/chatters`)).json()).chatters;
                let viewers = flatMap(active);
                await client.clients.db.watchtime(channel, flatMap(viewers));
            }
        }
    }, 30000);
    if (client.config.automessagedelay === 0) return;
    client.automessage = setInterval(async () => {
        for (let channel of client.channels) {
            channel = channel.replace(/#+/g, "");
            let uptime = await (await fetch(`https://decapi.me/twitch/uptime/${channel}`)).text();
            if (uptime !== `${channel} is offline`) {
                if (!client.messages[channel]) return client.clients.logger.error(`Für den Kanal ${channel} sind keine automatischen Nachrichten angegeben.`);
                client.say(channel, getRandom(client.messages[channel]));
            }
        }
    }, 60000 * client.config.automessagedelay);
};