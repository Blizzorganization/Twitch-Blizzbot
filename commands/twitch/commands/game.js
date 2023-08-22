import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.user;
export const alias = ["spiel"];
/**
 * @name game
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const resp = await fetch(`https://decapi.me/twitch/game/${target.slice(1)}`);
    const game = await resp.text();

    client.say(target, `${target.slice(1)} spielt gerade: ${game}`);
}
