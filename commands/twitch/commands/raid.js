import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.vip;
/** @type {string[]} */
export const alias = [];
/**
 * @author Speed-r
 * @name Raidminutes
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export function run(client, target) {
    const minutes = client.config.Raidminutes;
    setTimeout(ende, 60000 * minutes);

    client.say(target, "/followersoff");
    client.say(target, `/me Der Follower Modus wurde für die nächsten ${minutes} Minuten deaktiviert.`);
    /**
     * starts follower only mode after timeout
     */
    function ende() {
        client.say(target, `/followers 5 `);
        client.say(target, `/me Der Follower Modus wurde Aktiviert.`);
    }
}
