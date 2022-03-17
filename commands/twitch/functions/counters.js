const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.mod;
exports.alias = ["counter"];
/**
 * @name counters
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    let appHelp = "";
    const counters = await client.clients.db.allCounters(target);
    if (counters && counters.length > 0) {
        const counternames = counters.map(c => c.name);
        appHelp = `Es sind folgende Zähler hinterlegt: ${counternames.join(", ")}`;
    } else {
        appHelp = "Es sind keine Zähler hinterlegt.";
    }
    client.say(target, appHelp);
};