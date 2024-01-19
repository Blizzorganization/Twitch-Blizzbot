import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name editCounter
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
    if (!args || args.length !== 3) {
        await client.say(
            target,
            "Du musst angeben, welchen Zähler du bearbeiten willst, ob du den Wert oder die Erhöhung ändern willst und auf welchen Wert du dies anpassen willst.",
        );
        return;
    }
    const name = args.shift();
    const counter = await client.clients.db.readCounter(target, name);
    const field = args.shift().toLowerCase();
    const value = args.shift();
    if (!counter) {
        await client.say(target, `Ich kenne keinen Zähler ${name}.`);
        return;
    }
    let num = undefined;
    try {
        num = parseInt(value);
    } catch (e) {
        await client.say(target, "Dein Letztes Argument muss eine Ganzzahl sein.");
        return;
    }
    switch (field) {
        case "inc":
        case "increase":
        case "erhöhung":
            await client.clients.db.editCounter(target, name, num);
            break;
        case "val":
        case "value":
        case "wert":
            await client.clients.db.setCounter(target, name, num);
            break;
        default:
            await client.say(target, "Mögliche Aktionen sind `val` und `inc`.");
            return;
    }
    await client.say(target, `${user}, der Zähler ${name} wurde editiert.`);
    logger.info(`* Edited Counter ${name}`);
}
