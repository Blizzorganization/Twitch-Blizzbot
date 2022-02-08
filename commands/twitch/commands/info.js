const { permissions } = require("../../../modules/constants");
const fetch = require("node-fetch").default;

exports.help = true;
exports.perm = permissions.user;
/**
 * @name info
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
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
};