import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
export const alias = ["ccmds"];
/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    let appHelp = "";
    const coms = await client.clients.db.allCcmds(target, permissions.mod);
    if (coms.length > 0) {
        appHelp = `Es sind folgende Mod-Commands hinterlegt: ${coms.join(", ")}`;
    } else {
        appHelp = "Es sind keine Mod-Commands hinterlegt.";
    }
    client.say(target, appHelp);
}
