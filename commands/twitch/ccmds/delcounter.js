import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name delCounter
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
    let cname;
    while (args.length > 0) {
        if (!cname || cname == "") cname = args.shift().toLowerCase();
    }
    if (cname) {
        await client.clients.db.delCounter(target.replace(/#+/g, ""), cname);
        client.say(target, `${user}, der Zähler ${cname} wurde entfernt.`);
        logger.log("command", `* Deleted Counter ${cname}`);
    } else {
        client.say(target, "Du musst angeben, welchen Zähler du löschen möchtest.");
    }
}
