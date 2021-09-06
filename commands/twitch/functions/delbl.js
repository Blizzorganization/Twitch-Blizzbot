exports.help = false;
exports.perm = true;
/**
 * @name delbl
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) return client.say(target, "Du musst angeben, was du von der Blacklist entfernen willst!");
    let blremove = args.join(" ").toLowerCase();
    let blacklist = client.blacklist[target.replace(/#+/g, "")];
    if (!blacklist.includes(blremove)) return client.say(target, `"${blremove}" wird nicht gelöscht, kann also auch nicht aus der Blacklist entfernt werden.`);
    client.blacklist[target.replace(/#+/g, "")] = client.blacklist[target.replace(/#+/g, "")].filter(b => b !== blremove);
    await client.clients.db.saveBlacklist();
    client.say(target, `"${blremove}" wurde von der Blacklist entfernt`);
    client.clients.logger.log("info", `* Removed "${blremove}" from the Blacklist of ${target}`);
};