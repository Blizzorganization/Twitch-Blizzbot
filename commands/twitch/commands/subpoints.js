import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name subpoints
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const pointsrequest = await fetch(`https://decapi.me/twitch/subpoints/${target.slice(1)}`);
    const points = await pointsrequest.text();

    await client.say(target, `${target.slice(1)} hat zur Zeit ${points} Subpoints`);
}
