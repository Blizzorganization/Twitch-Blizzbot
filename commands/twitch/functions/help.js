import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.user;
export const alias = ["befehl", "befehle", "command", "commands", "cmd", "cmds"];
/**
 * @name help
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    let appHelp = `!${client.helplist.sort().join(", !")}`;
    const ccmds = (await client.clients.db.allCcmds(target)).sort();
    if (ccmds.length > 0) appHelp += `, ${ccmds.join(", ")}`;
    client.say(target, `Der Bot kann folgende Commands: ${appHelp}`);
}
