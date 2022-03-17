import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const aliases = await client.clients.db.getAliases(target);
    const mappedAliases = [];
    (aliases.sort((a, b) => a.alias > b.alias ? 1 : -1)).forEach((alias) => {
        if (!mappedAliases[alias.command]) {
            mappedAliases[alias.command] = [];
        }
        mappedAliases[alias.command].push(alias.alias);
    });
    const mappedStrings = [];
    for (const command in mappedAliases) {
        mappedStrings.push(`${command}= ${mappedAliases[command].join(", ")}`);
    }
    client.say(target, `Folgende Aliase sind hinterlegt: ${mappedStrings.join(" | ")}`);
}
// eval clients.twitch.commands.get("aliase").run({clients, say: console.log}, "a")