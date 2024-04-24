import { logger } from "twitch-blizzbot/logger";

/**
 * @param  {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param  {string} channel
 * @param  {string} username
 * @param  {number} numbofSubs
 * @param  {string} recipient
 * @param  {import("tmi.js").SubMethod} methods
 * @param  {import("tmi.js").SubUserstate} userstate
 */
export function event(client, channel, username, numbofSubs, recipient, methods, userstate) {
    const tier = userstate["msg-param-sub-plan"];
    if (!tier) return;

    // message for Action
    logger.info(`${username} gifted ${recipient} a subscription.${numbofSubs} Sub`);
}
