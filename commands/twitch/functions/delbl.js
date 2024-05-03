import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name delblacklist
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} _context
 * @param {string} _msg
 * @param {boolean} _self
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, target, _context, _msg, _self, args) {
    if (!args || args.length == 0) {
        await client.say(target, "Du musst angeben, was du von der Blacklist entfernen willst!");
        return;
    }
    const blremove = args.join(" ").toLowerCase();
    const blacklist = client.blacklist[target.replace(/#+/g, "")];
    const blacklistEntry = blacklist.find((entry) => entry.blword == blremove);
    if (!blacklistEntry) {
        await client.say(
            target,
            `"${blremove}" ist in keiner Blacklist vorhanden, kann also auch nicht aus der Blacklist entfernt werden.`,
        );
        return;
    }
    client.blacklist[target.replace(/#+/g, "")] = blacklist.filter((b) => b !== blacklistEntry);
    await client.clients.db.removeBlacklistWord(target, blremove);
    await client.say(target, `"${blremove}" wurde von der Blacklist entfernt`);
    logger.info(`* Removed "${blremove}" from the Blacklist of ${target}`);
}
