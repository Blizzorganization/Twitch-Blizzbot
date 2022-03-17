const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.mod;
/**
 * @name delalias
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    const user = context["display-name"];
    if (args.length == 0) return;
    await client.clients.db.deleteAlias(target.replace(/#+/g, ""), args[0]);
    client.say(target, `${user} der Alias für den Moderatoren Command ${args[0]} wurde entfernt.`);
    client.clients.logger.log("command", `* Deleted alias ${args[0]}`);
};