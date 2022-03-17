import { logger } from "twitch-blizzbot/logger";

/**
 * @listens primepaidupgrade
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 */
export function event(client, channel, username) {

    // message for Action
    logger.info(`${username} extended subcription`);
    client.say(channel, `/me ${username} hat seinen geschenkten Sub verlängert!`);
}