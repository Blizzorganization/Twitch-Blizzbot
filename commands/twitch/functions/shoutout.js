const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.mod;
exports.alias = ["so"];
/**
 * @name Shoutout
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) {
        client.say(target, "Du musst einen Namen angeben.");
        return;
    }
    const user = args[0];

    client.say(target, `Kleines Shoutout an ${user} schaut doch auch mal bei https://www.twitch.tv/${user.toLowerCase()} vorbei`);
};