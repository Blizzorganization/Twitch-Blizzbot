const { permissions } = require("twitch-blizzbot/constants");
const _ = require("lodash");

exports.help = false;
exports.perm = permissions.mod;
/**
 * @name delbl
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length == 0) return client.say(target, "Du musst angeben, was du von der Blacklist entfernen willst!");
    const blremove = args.join(" ").toLowerCase();
    const blacklists = client.blacklist[target.replace(/#+/g, "")];
    const blacklist = _.find(blacklists, (bl) => bl.includes(blremove));
    const blacklistName = _.findKey(blacklists, (bl) => bl.includes(blremove));
    if (!blacklist) return client.say(target, `"${blremove}" ist in keiner Blacklist vorhanden, kann also auch nicht aus der Blacklist entfernt werden.`);
    client.blacklist[target.replace(/#+/g, "")][blacklistName] = blacklist.filter(b => b !== blremove);
    await client.clients.db.saveBlacklist();
    client.say(target, `"${blremove}" wurde von der Blacklist entfernt`);
    client.clients.logger.info(`* Removed "${blremove}" from the Blacklist of ${target}`);
};