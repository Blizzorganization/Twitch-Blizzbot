const fetch = require("node-fetch").default;
exports.help = false;
exports.perm = true;
exports.alias = ["so"];
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
    if (!args || args.length == 0) {
        client.say(target, "Du musst den Namen angeben.");
        return;
    }
    let user = args[0];
    let resp = await fetch(`https://decapi.me/twitch/title/${user}`);
    let title = await resp.text();
    let res = await fetch(`https://decapi.me/twitch/game/${user}`);
    let game = await res.text();

    client.say(target, `Kleines Shoutout an ${user} er streamte ${game} mit dem Titel: ${title}`);
};