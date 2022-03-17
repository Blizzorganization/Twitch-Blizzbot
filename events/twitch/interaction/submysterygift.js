/* eslint-disable no-unused-vars */

import { logger } from "twitch-blizzbot/logger";

/**
 * @listens mysterysubgift
 * @param  {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param  {string} channel
 * @param  {string} username
 * @param  {string} recipient
 * @param  {import("tmi.js").SubMethod} methods
 * @param  {import("tmi.js").SubUserstate} userstate
 */
export function event(client, channel, username, numbofSubs, recipient, methods, userstate) {
    const tierlist = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    const tiers = userstate["msg-param-sub-plan"];
    const ave = tierlist[tiers];
    const senderCount = ~~userstate["msg-param-sender-count"];

    // message for Action
    logger.info(`${username} gifted ${recipient} a subscription.${numbofSubs} Sub`);
}