import lodash from "lodash";
import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

const { find, findKey } = lodash;

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name delblacklist
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    if (!args || args.length == 0) {
        return client.say(target, "Du musst angeben, was du von der Blacklist entfernen willst!");
    }
    const blremove = args.join(" ").toLowerCase();
    const blacklists = client.blacklist[target.replace(/#+/g, "")];
    const blacklist = find(blacklists, (bl) => bl.includes(blremove));
    const blacklistName = findKey(blacklists, (bl) => bl.includes(blremove));
    if (!blacklist) {
        return client.say(
            target,
            `"${blremove}" ist in keiner Blacklist vorhanden, kann also auch nicht aus der Blacklist entfernt werden.`,
        );
    }
    client.blacklist[target.replace(/#+/g, "")][blacklistName] = blacklist.filter((b) => b !== blremove);
    await client.clients.db.saveBlacklist();
    client.say(target, `"${blremove}" wurde von der Blacklist entfernt`);
    logger.info(`* Removed "${blremove}" from the Blacklist of ${target}`);
}
