import { logger } from "twitch-blizzbot/logger";

/**
 * @listens raided
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} viewers
 */
export function event(client, channel, username, viewers) {

    // message for Action
    logger.info(`${username} raid ${viewers} viewer!`);
    if (viewers < 10) return;
    client.say(channel, `/me ${username} Raidet mit ${viewers} Zuschauer!`);
    if (viewers > 60) client.commands.get("raid").run(client, channel);
}