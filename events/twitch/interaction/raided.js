import { logger } from "twitch-blizzbot/logger";

/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} viewers
 */
export async function event(client, channel, username, viewers) {
    // message for Action
    logger.info(`${username} raid ${viewers} viewer!`);
    if (viewers < 10) return;
    await client.say(channel, `/me ${username} Raidet mit ${viewers} Zuschauer!`);
}
