const { permissions } = require("twitch-blizzbot/constants");
const { time } = require("twitch-blizzbot/functions");

exports.help = true;
exports.perm = permissions.user;
/**
 * @name uptime
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const fetch = (await import("node-fetch")).default;
    const uptimerequest = await fetch(`https://decapi.me/twitch/uptime/${target.slice(1)}`, {});
    const uptime = time(await uptimerequest.text());

    if (uptime == `${target.slice(1)} is offline`) {
        client.say(target, `${target.slice(1)} ist offline.`);
    } else {
        client.say(target, `${target.slice(1)} ist seit ${uptime} live. blizzorLogo`);
    }
};