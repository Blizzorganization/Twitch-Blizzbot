import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    const user = context["display-name"];
    if (args.length > 1) {
        const newcmd = args.shift().toLowerCase();
        const res = args.join(" ");
        if (!res || res == "") return client.say(target, "Du musst angeben, was die Antwort sein soll.");
        await client.clients.db.newCcmd(target.replace(/#+/g, ""), newcmd, res, permissions.mod);
        client.say(target, `${user} der Mod-Befehl ${newcmd} wurde hinzugefügt.`);
        logger.log("command", `* Added Customcommand ${newcmd}`);
    } else {
        client.say(target, "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest.");
    }
}
