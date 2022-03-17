/* eslint-disable no-unused-vars */

import { logger } from "twitch-blizzbot/logger";

/**
 * @listens subgift
 * @param  {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param  {string} channel
 * @param  {string} username
 * @param  {number} streakMonths
 * @param  {string} recipient
 * @param  {import("tmi.js").SubMethod} methods
 * @param  {import("tmi.js").SubUserstate} userstate
 */
export function event(client, channel, username, streakMonths, recipient, methods, userstate) {
    const tierlist = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    const tiers = userstate["msg-param-sub-plan"];
    const ave = tierlist[tiers];
    // message for Action
    logger.info(`${username} gifted ${recipient} a subscription.`);
    client.say(channel, `/me ${username} hat ${recipient} einen ${ave} Sub geschenkt, vielen dank für deine Unterstützung !`);

}