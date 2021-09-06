const { calcWatchtime } = require("../../../modules/functions");

exports.help = true;
exports.perm = false;
exports.alias = ["wt"];
/**
 * @name watchtime
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    let user, watchtime;
    user = args[0]?.toLowerCase();
    if (user) {
        watchtime = await client.clients.db.getWatchtime(target, user, "alltime");
        if (!watchtime) return client.say(target, "Diesen Nutzer kenne ich nicht.");
    } else {
        user = context["username"];
        watchtime = await client.clients.db.getWatchtime(target, context["username"], "alltime");
        if (!watchtime) watchtime = 1;
    }
    client.say(target, `${user} schaut ${target.slice(1)} schon seit ${calcWatchtime(watchtime)}`);
};