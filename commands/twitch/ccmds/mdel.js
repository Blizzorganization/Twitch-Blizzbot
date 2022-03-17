import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/**
 * @name cdel
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
    if (args.length == 0) return client.say(target, "Du musst einen Befehl angeben, der gelöscht werden soll.");
    const cmd = await client.clients.db.getCcmd(target, args[0]);
    if (!cmd) return client.say(target, `Ich kenne keinen Befehl ${args[0]}.`);
    if (cmd.permissions !== permissions.mod) return client.say(target, `${args[0]} ist kein Mod Only Customcommand.`);
    await client.clients.db.delCcmd(target.replace(/#+/g, ""), args[0]);
    client.say(target, `${user} der Mod-Befehl ${args[0]} wurde gelöscht.`);
    logger.log("command", `* Deleted Customcommand ${args[0]}`);
}