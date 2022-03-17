const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.dev;
exports.alias = [];
/**
 * @name watchtime
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) return client.say(target, "Du musst einen neuen Namen angeben.");
    const oldName = args[0].toLowerCase();
    const newName = context["username"];
    const existingUser = await client.clients.db.getWatchtime(target, newName, "alltime");
    if (existingUser) return client.say(target, "Dieser Nutzer hat bereits watchtime gesammelt. Wenn du die watchtime dieses Accounts trotzdem übertragen möchtest, wende dich bitte an eine:n Moderator:in");
    await client.clients.db.renameWatchtimeUser(target, oldName, newName);
    client.say(target, `Deine Watchtime wurde erfolgreich von ${oldName} umgeschrieben.`);
};