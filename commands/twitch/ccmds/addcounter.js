import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/**
 * @name addcounter
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
    let cname, increase, defaultVal;
    while (args.length > 0) {
        if (!cname || cname == "") cname = args.shift().toLowerCase();
        if (!increase || increase == "") increase = args.shift();
        if (!defaultVal || defaultVal == "") defaultVal = args.shift();
    }
    if (cname) {
        await client.clients.db.newCounter(target.replace(/#+/g, ""), cname, isNaN(parseInt(increase)) ? undefined : parseInt(increase), isNaN(parseInt(defaultVal)) ? undefined : parseInt(defaultVal));
        client.say(target, `${user} der Zähler ${cname} wurde hinzugefügt.`);
        logger.log("command", `* Added Counter ${cname}`);
    } else {
        client.say(target, "Du musst angeben, welchen Zähler (mit optionaler Steigung und einem Startwert) du hinzufügen möchtest.");
    }
}