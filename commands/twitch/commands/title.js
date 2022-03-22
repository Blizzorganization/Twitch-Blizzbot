import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.user;
export const alias = ["titel"];
/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const resp = await fetch(`https://decapi.me/twitch/title/${target.slice(1)}`);
    const title = await resp.text();

    client.say(target, `Der Titel des Streams lautet: ${title}`);
}
