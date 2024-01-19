import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name editCcmd
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
    if (!args || args.length == 0) {
        await client.say(target, "Welchen Mod-Command möchtest du bearbeiten?");
        return;
    }

    const cmd = await client.clients.db.getCcmd(target, args[0]);
    if (!cmd) {
        await client.say(target, `Ich kenne keinen Command ${args[0]}.`);
        return;
    }
    if (cmd.permissions !== permissions.mod) {
        await client.say(target, `${args[0]} ist kein Mod Only Customcommand.`);
        return;
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.join(" ");
    await client.clients.db.editCcmd(target.replace(/#+/g, ""), newcmd, res);
    await client.say(target, `${user}, der Mod-Command ${newcmd} wurde editiert.`);
    logger.log("command", `* Edited Customcommand ${newcmd}`);
}
