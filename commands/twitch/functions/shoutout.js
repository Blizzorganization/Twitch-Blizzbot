const { permissions } = require("../../../modules/constants");
const fetch = require("node-fetch").default;
exports.help = false;
exports.perm = permissions.mod;
exports.alias = ["so"];
/**
 * @name Shoutout
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) {
        client.say(target, "Du musst den Namen angeben.");
        return;
    }
    const user = args[0];
    const resp = await fetch(`https://decapi.me/twitch/title/${user}`);
    const title = await resp.text();
    const res = await fetch(`https://decapi.me/twitch/game/${user}`);
    const game = await res.text();

    client.say(target, `Kleines Shoutout an ${user} er streamte ${game} mit dem Titel: ${title}`);
};