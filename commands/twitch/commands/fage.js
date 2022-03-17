const { permissions } = require("twitch-blizzbot/constants");
const { time } = require("twitch-blizzbot/functions");

exports.help = true;
exports.perm = permissions.user;
exports.alias = ["folgezeit", "followage"];
/**
 * @name followage
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    const fetch = (await import("node-fetch")).default;
    let user = args[0].replace("@", "");
    if (!user || user == "") user = context["display-name"];
    const resp = await fetch(`https://2g.be/twitch/following.php?user=${user}&channel=${target.slice(1)}&format=mwdhms`);
    const followage = time(await resp.text());

    client.say(target, followage);
};