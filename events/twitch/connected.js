import lodash from "lodash";
import fetch from "node-fetch";
import { getRandom } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";

const { flatMap } = lodash;

/**
 * @listens twitch:connected
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} addr
 * @param {number} port
 */
export async function event(client, addr, port) {
    logger.info(`* Connected to ${addr}:${port}`);
    client.started = true;
    for (const channel of client.config.channels) {
        client.clients.db.newChannel(channel);
    }
    client.clients.db.loadBlacklist();
    client.watchtime = setInterval(async () => {
        for (const channel of client.channels) {
            const uptimeRequest = await fetch(`https://decapi.me/twitch/uptime/${channel.slice(1)}`).catch((err) => {
                logger.error(`Received an Error trying to fetch the uptime API: ${err}`);
            });
            if (!uptimeRequest) return;
            const uptime = await uptimeRequest.text().catch((err) => {
                logger.error(`Got an error trying to parse a string out of the uptime request: ${err}`);
            });
            if (!uptime) return;
            if (`#${uptime}` !== `${channel} is offline`) {
                const chattersRequest = await fetch(
                    `http://tmi.twitch.tv/group/user/${channel.slice(1)}/chatters`,
                ).catch((err) => {
                    logger.error(`Received an Error trying to fetch the current list of viewers: ${err}`);
                });
                if (!chattersRequest) return;
                /** @type {{chatters: {[key: string]: string[]}}} */
                // @ts-ignore
                const jsonResponse = await chattersRequest.json().catch((err) => {
                    logger.error(`Received an Error trying to parse JSON out of the chatters Request: ${err}`);
                });
                if (!jsonResponse) return;
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
                if (!client.messages[channel]) {
                    return logger.error(`Für den Kanal ${channel} sind keine automatischen Nachrichten angegeben.`);
                }
                const automessage = getRandom(client.messages[channel]);
                if (automessage) client.say(channel, automessage);
            }
        }
    }, 60000 * client.config.automessagedelay);
}
