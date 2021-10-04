exports.help = false;
exports.perm = true;

/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const aliases = await client.clients.db.getAliases(target);
    const mappedAliases = [];
    aliases.forEach((alias) => {
        if (!mappedAliases[alias.command]) {
            mappedAliases[alias.command] = [];
        }
        mappedAliases[alias.command].push(alias.alias);
    });
    const mappedStrings = [];
    mappedAliases.forEach((a, cmd) => {
        mappedStrings.push(`${cmd}: ${a.join(", ")}`);
    });
    client.say(target, `Folgende Aliase sind hinterlegt: ${mappedStrings.join("; ")}`);
};