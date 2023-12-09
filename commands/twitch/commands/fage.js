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
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    let user;
    user = args[0]?.toLowerCase().replace("@", "");
    if (!user || user == "") user = context["display-name"];

    const apitoken = client.config.clientId;
    const resp = await fetch(`https://decapi.me/twitch/followage/${target.slice(1)}/${user}?token=${apitoken}`);
    const followage = time(await resp.text());

    client.say(target, `@${user} folgt schon: ${followage}`);
}
