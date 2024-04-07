import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const aliases = await client.clients.db.getAliases(target);
    const mappedAliases = [];
    aliases
        .sort((a, b) => (a.alias > b.alias ? 1 : -1))
        .forEach((commandAlias) => {
            if (!mappedAliases[commandAlias.command]) {
                mappedAliases[commandAlias.command] = [];
            }
            mappedAliases[commandAlias.command].push(commandAlias.alias);
        });
    const mappedStrings = [];
    for (const command in mappedAliases) {
        mappedStrings.push(`${command}= ${mappedAliases[command].join(", ")}`);
    }
    await client.say(target, `Folgende Aliase sind hinterlegt: ${mappedStrings.join(" | ")}`);
}
