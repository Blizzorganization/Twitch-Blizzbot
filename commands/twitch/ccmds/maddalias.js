import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name addedAlias
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
    if (args.length > 1) {
        const newcmd = args.shift().toLowerCase();
        const res = args.join(" ");
        if (!res || res == "") return client.say(target, "Du musst angeben, worauf der Alias verknüpft sein soll.");
        if (!(await client.clients.db.getCcmd(target, res))) {
            return client.say(target, "Diesen Befehl kenne ich nicht.");
        }
        await client.clients.db.newAlias(target.replace(/#+/g, ""), newcmd, res);
        client.say(target, `${user}, der Alias ${newcmd} für den Moderatoren Command ${res} wurde hinzugefügt.`);
        logger.log("command", `* Added Alias ${newcmd} for Customcommand ${res}`);
    } else {
        client.say(target, "Du musst angeben, welchen Alias und welchen Befehl du verwenden möchtest.");
    }
}
