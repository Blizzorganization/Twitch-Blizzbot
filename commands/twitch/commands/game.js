const { permissions } = require("twitch-blizzbot/constants");

exports.help = true;
exports.perm = permissions.user;
exports.alias = ["spiel"];
/**
 * @name game
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const fetch = (await import("node-fetch")).default;
    const resp = await fetch(`https://decapi.me/twitch/game/${target.slice(1)}`);
    const game = await resp.text();

    client.say(target, `${target.slice(1)} spielt gerade: ${game}`);
};