const fetch = require("node-fetch").default;
exports.help = true;
exports.perm = false;
exports.alias = ["spiel"];
/**
 * @name game
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    let resp = await fetch(`https://decapi.me/twitch/game/${target.slice(1)}`);
    let game = await resp.text();

    client.say(target, `Er spielt gerade: ${game}`);
};