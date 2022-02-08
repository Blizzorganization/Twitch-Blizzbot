const { permissions } = require("../../../modules/constants");
const fetch = require("node-fetch").default;
const { time } = require("../../../modules/functions");

exports.help = true;
exports.perm = permissions.user;
exports.alias = ["alter"];
/**
 * @name age
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
    const resp = await fetch(`https://decapi.me/twitch/accountage/${user}`);
    const age = time(await resp.text());

    client.say(target, `Der Account ${user} wurde vor ${age} erstellt.`);
};