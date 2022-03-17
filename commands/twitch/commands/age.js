const { permissions } = require("twitch-blizzbot/constants");
const { time } = require("twitch-blizzbot/functions");

exports.help = true;
exports.perm = permissions.user;
exports.alias = ["alter"];
/**
 * @name age
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
    const resp = await fetch(`https://decapi.me/twitch/accountage/${user}`);
    const age = time(await resp.text());

    client.say(target, `Der Account ${user} wurde vor ${age} erstellt.`);
};