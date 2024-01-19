import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name reCcmd
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
        await client.say(target, "Welchen Command möchtest du umbenennen?");
        return;
    }
    const [commandName, newName] = args;
    const cmd = await client.clients.db.getCcmd(target, commandName);
    if (!cmd) {
        await client.say(target, `Ich kenne keinen Command ${commandName}.`);
        return;
    }
    const existingCmd = await client.clients.db.getCcmd(target, newName);
    if (existingCmd) {
        await client.say(target, `Es gibt bereits einen Command ${newName}`);
        return;
    }
    if (!newName) {
        await client.say(target, `Du musst angeben in was ${commandName} umbenannt werden soll.`);
        return;
    }
    await client.clients.db.renameCCmd(target.replace(/#+/g, ""), commandName, newName);

    await client.say(target, `${user}, der Command ${commandName} wurde zu ${newName} umbenannt.`);
    logger.log("command", `* Rename Customcommand ${commandName} to ${newName}`);
}
