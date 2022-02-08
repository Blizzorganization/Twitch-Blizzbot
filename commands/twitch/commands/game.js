const { permissions } = require("../../../modules/constants");
const fetch = require("node-fetch").default;

exports.help = true;
exports.perm = permissions.user;
exports.alias = ["spiel"];
/**
 * @name game
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const resp = await fetch(`https://decapi.me/twitch/game/${target.slice(1)}`);
    const game = await resp.text();

    client.say(target, `${target.slice(1)} spielt gerade: ${game}`);
};