import { logger } from "twitch-blizzbot/logger";

/**
 * @param  {import("twitch-blizzbot/twitchclient").TwitchClient} _client
 * @param  {string} _channel
 * @param  {string} username
 * @param  {number} numbofSubs
 * @param  {string} recipient
 * @param  {import("tmi.js").SubMethod} _methods
 * @param  {import("tmi.js").SubUserstate} userstate
 */
export function event(_client, _channel, username, numbofSubs, recipient, _methods, userstate) {
    const tier = userstate["msg-param-sub-plan"];
    if (!tier) return;

    // message for Action
    logger.info(`${username} gifted ${recipient} a subscription.${numbofSubs} Sub`);
}
