const { calcWatchtime } = require("../../../modules/functions");
const { currentMonth } = require("../../../modules/functions");

exports.help = false;
exports.perm = true;
/**
 * @name mtime
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) {
        client.say(target, "Du musst einen Nutzer angeben.");
        return;
    }
    const user = args[0].toLowerCase();
    const watchtime = await client.clients.db.getWatchtime(target, user, currentMonth());
    if (!watchtime) return client.say(target, "Diesen Nutzer kenne ich nicht.");
    client.say(target, `${user} schaut ${target.slice(1)} schon diesen Monat seit ${calcWatchtime(watchtime)}`);
};