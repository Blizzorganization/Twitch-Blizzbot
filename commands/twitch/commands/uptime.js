import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";
import { time } from "twitch-blizzbot/functions";

export const help = true;
export const perm = permissions.user;
/** @type {string[]} */
export const alias = [];
/**
 * @name uptime
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const uptimerequest = await fetch(`https://decapi.me/twitch/uptime/${target.slice(1)}`, {});
    const uptime = time(await uptimerequest.text());

    if (uptime == `${target.slice(1)} is offline`) {
        client.say(target, `${target.slice(1)} ist offline.`);
    } else {
        client.say(target, `${target.slice(1)} ist seit ${uptime} live. blizzorLogo`);
    }
}
