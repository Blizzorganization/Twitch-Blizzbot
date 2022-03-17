const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.mod;
exports.alias = ["ccmds"];
/**
 * @name ccmd
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    let appHelp = "";
    const coms = await client.clients.db.allCcmds(target, permissions.mod);
    if (coms.length > 0) {
        appHelp = `Es sind folgende Mod-Commands hinterlegt: ${coms.join(", ")}`;
    } else {
        appHelp = "Es sind keine Commands hinterlegt.";
    }
    client.say(target, appHelp);
};