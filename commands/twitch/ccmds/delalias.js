import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name deleteAlias
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    const user = context["display-name"];
    if (args.length == 0) return client.say(target, "Du musst angeben, welcher Alias gelöscht werden soll.");
    // eslint-disable-next-line no-shadow
    const alias = await client.clients.db.resolveAlias(target, args[0]);
    if (!alias) return client.say(target, `${user}, es gibt keinen Alias mit dem Namen ${args[0]}.`);
    await client.clients.db.deleteAlias(target.replace(/#+/g, ""), args[0]);
    client.say(target, `${user}, der Alias ${args[0]} wurde entfernt.`);
    logger.log("command", `* Deleted alias ${args[0]}`);
}
