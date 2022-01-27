const fetch = require("node-fetch").default;
const { time } = require("../../../modules/functions");

exports.help = true;
exports.perm = false;
exports.alias = ["folgezeit", "followage"];
/**
 * @name followage
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    let user = args[0];
    if (!user || user == "") user = context["display-name"];
    const resp = await fetch(`https://2g.be/twitch/following.php?user=${user}&channel=${target.slice(1)}&format=mwdhms`);
    const followage = time(await resp.text());

    client.say(target, followage);
};