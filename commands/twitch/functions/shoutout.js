import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
export const alias = ["so"];
/**
 * @name Shoutout
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} _context
 * @param {string} _msg
 * @param {boolean} _self
 * @param {string[]} args
 */
export async function run(client, target, _context, _msg, _self, args) {
    if (!args || args.length == 0) {
        await client.say(target, "Du musst einen Namen angeben.");
        return;
    }
    const user = args[0];

    await client.say(
        target,
        `Kleines Shoutout an ${user} schaut doch auch mal bei https://www.twitch.tv/${user.toLowerCase()} vorbei`,
    );
}
