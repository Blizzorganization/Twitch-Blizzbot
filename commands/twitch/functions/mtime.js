import { permissions } from "twitch-blizzbot/constants";
import { calcWatchtime, currentMonth } from "twitch-blizzbot/functions";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name mtime
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    let user, watchtime;
    user = args[0]?.toLowerCase().replace("@", "");
    if (user) {
        watchtime = await client.clients.db.getWatchtime(target, user, currentMonth());
        if (!watchtime) return client.say(target, "Diesen Nutzer kenne ich nicht.");
    } else {
        user = context["username"];
        watchtime = await client.clients.db.getWatchtime(target, context["username"], currentMonth());
        if (!watchtime) watchtime = 1;
    }
    client.say(target, `${user} schaut ${target.slice(1)} diesen Monat schon seit ${calcWatchtime(watchtime)}`);
}
