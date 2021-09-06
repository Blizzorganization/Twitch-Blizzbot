exports.help = false;
exports.perm = true;
/**
 * @name delalias
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (args.length == 0) return;
    await client.clients.db.deleteAlias(target.replace(/#+/g, ""), args[0]);
    client.say(target, `Alias ${args[0]} wurde entfernt.`);
    client.clients.logger.log("command", `* Deleted alias ${args[0]}`);
};