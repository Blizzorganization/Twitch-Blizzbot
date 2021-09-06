const fetch = require("node-fetch").default;

exports.help = true;
exports.perm = false;
exports.alias = ["titel"];
/**
 * @name title
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    let resp = await fetch(`https://decapi.me/twitch/title/${target.slice(1)}`);
    let title = await resp.text();

    client.say(target, `Der Titel des Streams lautet: ${title}`);
};