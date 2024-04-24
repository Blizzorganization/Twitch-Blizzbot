import { logger } from "twitch-blizzbot/logger";

/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 */
export async function event(client, channel, username) {
    // message for Action
    logger.info(`${username} extended subcription`);
    await client.say(channel, `/me ${username} hat seinen geschenkten Sub verlängert!`);
}
