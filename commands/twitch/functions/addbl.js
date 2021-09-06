exports.help = false;
exports.perm = true;
/**
 * @name addbl
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) return client.say(target, "Du musst angeben, was du blockieren willst!");
    let blword = args.join(" ").toLowerCase();
    client.blacklist[target.replace(/#+/g, "")].push(blword);
    await client.clients.db.saveBlacklist();
    client.say(target, `"${blword}" wurde in die Blacklist eingetragen TPFufun`);
    client.clients.logger.log("info", `* Added "${blword}" to the Blacklist of ${target.replace(/#+/g, "")}`);
};