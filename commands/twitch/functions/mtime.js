import { permissions } from "twitch-blizzbot/constants";
import { calcWatchtime, currentMonth } from "twitch-blizzbot/functions";

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
    if (!args || args.length == 0) {
        client.say(target, "Du musst einen Nutzer angeben.");
        return;
    }
    const user = args[0].toLowerCase();
    const watchtime = await client.clients.db.getWatchtime(target, user, currentMonth());
    if (!watchtime) return client.say(target, "Diesen Nutzer kenne ich nicht.");
    client.say(target, `${user} schaut ${target.slice(1)} schon diesen Monat seit ${calcWatchtime(watchtime)}`);
}
