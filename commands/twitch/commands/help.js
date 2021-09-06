exports.help = false;
exports.perm = false;
exports.alias = ["befehl", "command", "commands", "cmd"];
/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    let appHelp = "!" + client.helplist.join(", !");
    var ccmds = await client.clients.db.allCcmds(target);
    if (ccmds.length > 0) appHelp += `, ${ccmds.join(", ")}`;
    client.say(target, `Der Bot kann folgende Commands: ${appHelp}`);
};