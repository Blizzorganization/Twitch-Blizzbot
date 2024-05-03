import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";
import { time } from "twitch-blizzbot/functions";

export const help = true;
export const perm = permissions.user;
export const alias = ["folgezeit", "followage"];
/**
 * @name followage
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} _msg
 * @param {boolean} _self
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, target, context, _msg, _self, args) {
    let user;
    user = args[0]?.toLowerCase().replace("@", "");
    if (!user || user == "") user = context["display-name"];

    if (user === target.slice(1)) {
        await client.say(target, "Man kann sich nicht selber folgen");
        return;
    }
    const apitoken = client.config.clientId;
    const resp = await fetch(`https://decapi.me/twitch/followage/${target.slice(1)}/${user}?token=${apitoken}`);
    const followage = time(await resp.text());
    if (followage.includes("ist kein Follower von")) {
        await client.say(target, `folgt dem Kanal nicht`);
        return;
    }
    await client.say(target, `${user} folgt ${target.slice(1)} schon: ${followage}`);
}
