const { permissions } = require("twitch-blizzbot/constants");

exports.help = true;
exports.perm = permissions.user;
exports.alias = ["titel"];
/**
 * @name title
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const fetch = (await import("node-fetch")).default;
    const resp = await fetch(`https://decapi.me/twitch/title/${target.slice(1)}`);
    const title = await resp.text();

    client.say(target, `Der Titel des Streams lautet: ${title}`);
};