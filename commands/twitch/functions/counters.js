exports.help = false;
exports.perm = true;
exports.alias = ["counter"];
/**
 * @name counters
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client 
 * @param {string} target
 */
exports.run = async (client, target) => {
    let appHelp = "";
    var counters = await client.clients.db.allCounters(target);
    if (counters && counters.length > 0) {
        counters = counters.map(c => c.name);
        appHelp = `Es sind folgende Zähler hinterlegt: ${counters.join(", ")}`;
    } else {
        appHelp = "Es sind keine Zähler hinterlegt.";
    }
    client.say(target, appHelp);
};