import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name addblacklist
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    if (!args || args.length < 2) {
        return client.say(target, "Du musst angeben, welches Wort du mit welcher Aktion versehen willst!");
    }
    let action = parseInt(args.shift(), 10);
    if (isNaN(action)) action = 0;
    const blword = args.join(" ").toLowerCase();
    client.blacklist[target.replace(/#+/g, "")].push({ blword, action, channel: target.replace(/#+/g, "") });
    await client.clients.db.newBlacklistWord(target, blword, action);
    client.say(target, `"${blword}" wurde in die Blacklist eingetragen TPFufun`);
    logger.info(`* Added "${blword}" to the "${action}" Blacklist of ${target.replace(/#+/g, "")}`);
}
