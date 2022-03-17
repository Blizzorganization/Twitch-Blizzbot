const { permissions } = require("twitch-blizzbot/constants");

exports.help = false;
exports.perm = permissions.mod;
/**
 * @name addbl
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (!args || args.length < 2) return client.say(target, "Du musst angeben, welches Wort du mit welcher Aktion versehen willst!");
    const action = args.shift();
    const blword = args.join(" ").toLowerCase();
    client.blacklist[target.replace(/#+/g, "")][action].push(blword);
    await client.clients.db.saveBlacklist();
    client.say(target, `"${blword}" wurde in die Blacklist eingetragen TPFufun`);
    client.clients.logger.info(`* Added "${blword}" to the "${action}" Blacklist of ${target.replace(/#+/g, "")}`);
};