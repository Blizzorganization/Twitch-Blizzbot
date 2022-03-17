import { logger } from "twitch-blizzbot/logger";

/**
 * @listens resub
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} months
 * @param {string} message
 * @param {import("tmi.js").SubUserstate} userstate
 */
export function event(client, channel, username, months, message, userstate) {
    const tierlist = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    const cumulativeMonths = userstate["msg-param-cumulative-months"];
    const tiers = userstate["msg-param-sub-plan"];
    const resubmessage = (message != null);
    const ave = tierlist[tiers];

    // message for Action
    logger.info(`${username} resub ${cumulativeMonths}. month`);
    client.say(channel, `/me Danke ${username} für deinen ${ave} Sub im insgesamt ${cumulativeMonths}. Monat${resubmessage ? ` Mit der Nachricht: ${message}` : ""} .`);
}