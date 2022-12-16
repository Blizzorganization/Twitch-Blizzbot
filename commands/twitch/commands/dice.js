import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.mod;
export const alias = [];
/**
 * @name dice
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const resp = await fetch("https://decapi.me/random/number/1/6");
    const dice = await resp.text();

    client.say(target, `Du hast eine ${dice} gewürfelt.`);
}
