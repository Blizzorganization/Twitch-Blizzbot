import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name addAlias
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, target, context, msg, self, args) {
    const user = context["display-name"];
    if (args.length <= 1) {
        await client.say(target, "Du musst angeben, welchen Alias und welchen Command du verwenden möchtest.");
        return;
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.join(" ");
    if (!res || res == "") {
        await client.say(target, "Du musst angeben, worauf der Alias verknüpft sein soll.");
        return;
    }
    if (!(await client.clients.db.getCcmd(target, res))) {
        await client.say(target, "Diesen Command kenne ich nicht.");
        return;
    }
    await client.clients.db.newAlias(target.replace(/#+/g, ""), newcmd, res);
    await client.say(target, `${user}, der Alias ${newcmd} für ${res} wurde hinzugefügt.`);
    logger.info(`* Added Alias ${newcmd} for Customcommand ${res}`);
}
