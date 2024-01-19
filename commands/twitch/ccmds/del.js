import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name deleteCcmd
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
    if (args.length == 0) {
        await client.say(target, "Du musst einen Command angeben, der gelöscht werden soll.");
        return;
    }
    const cmd = await client.clients.db.getCcmd(target, args[0]);
    if (!cmd) {
        await client.say(target, `Ich kenne keinen Command ${args[0]}.`);
        return;
    }
    if (cmd.permissions !== permissions.user) {
        await client.say(target, `${args[0]} ist kein Nutzer Customcommand.`);
        return;
    }
    await client.clients.db.delCcmd(target.replace(/#+/g, ""), args[0]);
    await client.say(target, `${user}, der Command ${args[0]} wurde entfernt.`);
    logger.log("command", `* Deleted Customcommand ${args[0]}`);
}
