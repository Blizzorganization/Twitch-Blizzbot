import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.user;
/** @type {string[]} */
export const alias = [];
/**
 * @name info
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const viewerrequest = await fetch(`https://decapi.me/twitch/viewercount/${target.slice(1)}`);
    let viewer = await viewerrequest.text();
    const followrequest = await fetch(`https://decapi.me/twitch/followcount/${target.slice(1)}`);
    const follow = await followrequest.text();
    const subrequest = await fetch(`https://decapi.me/twitch/subcount/${target.slice(1)}`);
    const sub = await subrequest.text();
    if (viewer == `${target.slice(1)} is offline`) {
        viewer = "0";
    }
    client.say(target, `${target.slice(1)} hat zur Zeit ${follow} Follower und ${sub} Subscriber`);
}
