import { permissions } from "twitch-blizzbot/constants";

import { logger } from "twitch-blizzbot/logger";
export const help = false;
export const perm = permissions.mod;
export const alias = [""];
/**
 * @name counter
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
    if (args.length < 1) {
        await client.say(target, "Du musst angeben, Welche Counter du auslesen möchtest.");
        return;
    }
    let counterName = args.shift();
    if (counterName) counterName = counterName.replace("!", "");
    const counter = await client.clients.db.readCounter(target, counterName);
    if (typeof counter !== "number") {
        await client.say(target, "Es gibt keinen Counter mit dem Namen.");
        return;
    }
    await client.say(target, `${user}, der Counter ${counterName} hat aktuell den Wert von ${counter}.`);
    logger.info(`* Showing Counter ${counterName}`);
}
