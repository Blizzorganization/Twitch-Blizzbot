import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name addCcmd
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
    if (args.length <= 1) {
        client.say(target, "Du musst angeben, welchen Command und welche Antwort du hinzufügen möchtest.");
        return;
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.join(" ");
    if (!res || res == "") return client.say(target, "Du musst angeben, was die Antwort sein soll.");
    const existingCmd = await client.clients.db.getCcmd(target.replace(/#+/g, ""), newcmd);
    if (existingCmd) {
        client.say(target, `${user}, der Command existiert bereits`);
        return;
    }
    await client.clients.db.newCcmd(target.replace(/#+/g, ""), newcmd, res, permissions.user);
    client.say(target, `${user}, der Command ${newcmd} wurde hinzugefügt.`);
    logger.log("command", `* Added Customcommand ${newcmd}`);
}
