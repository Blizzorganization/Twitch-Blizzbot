/* eslint-disable no-unused-vars */

import { logger } from "twitch-blizzbot/logger";

/**
 * @listens mysterysubgift
 * @param  {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param  {string} channel
 * @param  {string} username
 * @param  {number} numbofSubs
 * @param  {string} recipient
 * @param  {import("tmi.js").SubMethod} methods
 * @param  {import("tmi.js").SubUserstate} userstate
 */
export function event(client, channel, username, numbofSubs, recipient, methods, userstate) {
    const tierList = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    const tier = userstate["msg-param-sub-plan"];
    if (!tier) return;
    const tierName = tierList[tier];
    const senderCount = ~~userstate["msg-param-sender-count"];

    // message for Action
    logger.info(`${username} gifted ${recipient} a subscription.${numbofSubs} Sub`);
}
