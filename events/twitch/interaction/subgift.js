/**
 * @listens subgift
 * @param  {import("../../../modules/twitchclient").TwitchClient} client
 * @param  {string} channel
 * @param  {string} username
 * @param  {number} streakMonths
 * @param  {string} recipient
 * @param  {import("tmi.js").SubMethod} methods
 * @param  {import("tmi.js").SubUserstate} userstate
 */
exports.event = (client, channel, username, streakMonths, recipient, methods, userstate) => {
    const giftcount = ~~userstate["msg-param-promo-gift-total"];

    // message for Action
    client.clients.logger.log("info", `${username} gifted ${recipient} a subscription.`);
};