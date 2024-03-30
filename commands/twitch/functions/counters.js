import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
export const alias = [""];
/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    let appHelp = "";
    const counters = await client.clients.db.allCounters(target);
    if (counters && counters.length > 0) {
        const counternames = counters.map((c) => c.name);
        appHelp = `Es sind folgende Zähler hinterlegt: ${counternames.join(", ")}`;
    } else {
        appHelp = "Es sind keine Zähler hinterlegt.";
    }
    await client.say(target, appHelp);
}
