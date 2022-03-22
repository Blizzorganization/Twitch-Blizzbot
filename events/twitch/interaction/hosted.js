/* eslint-disable no-unused-vars */

import { logger } from "twitch-blizzbot/logger";

/**
 * @listens hosted
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} viewers
 * @param {Boolean} autohost
 */
export function event(client, channel, username, viewers, autohost) {
    // message for Action
    logger.info(`${username} hosted ${viewers} viewer!`);
    client.say(channel, `/me ${username} Hosted mit ${viewers} Zuschauer!`);
}
