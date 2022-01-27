const fetch = require("node-fetch").default;
const { time } = require("../../../modules/functions");

exports.help = true;
exports.perm = false;
/**
 * @name uptime
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const uptimerequest = await fetch(`https://decapi.me/twitch/uptime/${target.slice(1)}`, {});
    const uptime = time(await uptimerequest.text());

    if (uptime == `${target.slice(1)} is offline`) {
        client.say(target, `${target.slice(1)} ist offline.`);
    } else {
        client.say(target, `${target.slice(1)} ist seit ${uptime} live. blizzorLogo`);
    }
};