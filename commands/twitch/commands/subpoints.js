const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.mod;
/**
 * @name Subpoints
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const fetch = (await import("node-fetch")).default;
    const pointsrequest = await fetch(`https://decapi.me/twitch/subpoints/${target.slice(1)}`);
    const points = await pointsrequest.text();

    client.say(target, `${target.slice(1)} hat zur Zeit ${points} Subpoints`);
};