const { flatMap } = require("lodash");
const { getRandom } = require("twitch-blizzbot/functions");

/**
 * @listens twitch:connected
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} addr
 * @param {number} port
 */
exports.event = async (client, addr, port) => {
    const fetch = (await import("node-fetch")).default;
    client.clients.logger.info(`* Connected to ${addr}:${port}`);
    client.started = true;
    for (const channel of client.config.channels) {
        client.clients.db.newChannel(channel);
    }
    client.clients.db.loadBlacklist();
    client.watchtime = setInterval(async () => {
        for (const channel of client.channels) {
            const uptime = await (await fetch(`https://decapi.me/twitch/uptime/${channel.slice(1)}`)).text();
            if (`#${uptime}` !== `${channel} is offline`) {
                /** @type {{chatters: {[key: string]: string[]}}} */
                // @ts-ignore
                const jsonResponse = await (await fetch(`http://tmi.twitch.tv/group/user/${channel.slice(1)}/chatters`)).json();
                const active = jsonResponse.chatters;
                const viewers = flatMap(active);
                await client.clients.db.watchtime(channel, flatMap(viewers));
            }
        }
    }, 30000);
    if (client.config.automessagedelay === 0) return;
    client.automessage = setInterval(async () => {
        for (let channel of client.channels) {
            channel = channel.replace(/#+/g, "");
            const uptime = await (await fetch(`https://decapi.me/twitch/uptime/${channel}`)).text();
            if (uptime !== `${channel} is offline`) {
                if (!client.messages[channel]) return client.clients.logger.error(`Für den Kanal ${channel} sind keine automatischen Nachrichten angegeben.`);
                const automessage = getRandom(client.messages[channel]);
                if (automessage) client.say(channel, automessage);
            }
        }
    }, 60000 * client.config.automessagedelay);
};