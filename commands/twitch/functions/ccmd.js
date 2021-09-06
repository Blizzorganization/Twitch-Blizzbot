const { permissions } = require("../../../modules/constants");

exports.help = false;
exports.perm = true;
/**
 * @name ccmd
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client 
 * @param {string} target
 */
exports.run = async (client, target) => {
    let appHelp = "";
    var coms = await client.clients.db.allCcmds(target, permissions.mod);
    if (coms.length > 0) {
        appHelp = `Es sind folgende Commands hinterlegt: ${coms.join(", ")}`;
    } else {
        appHelp = "Es sind keine Commands hinterlegt.";
    }
    client.say(target, appHelp);
};