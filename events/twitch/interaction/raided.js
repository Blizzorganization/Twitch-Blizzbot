import { logger } from "twitch-blizzbot/logger";
import { run as runRaidCommand } from "commands/twitch/commands/raid.js";

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
    if (viewers > 60) await runRaidCommand(client, channel);
}
