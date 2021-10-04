const { permissions } = require("../../../modules/constants");

exports.help = false;
exports.perm = true;
/**
 * @name cdel
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (args.length == 0) return;
    const cmd = await client.clients.db.getCcmd(target, args[0]);
    if (!cmd) return client.say(target, `Ich kenne keinen Befehl ${args[0]}.`);
    if (cmd.permissions !== permissions.mod) return client.say(target, `${args[0]} ist kein Mod Only Customcommand.`);
    await client.clients.db.delCcmd(target.replace(/#+/g, ""), args[0]);
    client.say(target, `Befehl ${args[0]} wurde gelöscht.`);
    client.clients.logger.log("command", `* Deleted Customcommand ${args[0]}`);
};