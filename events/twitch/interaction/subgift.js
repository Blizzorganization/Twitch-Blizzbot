/* eslint-disable no-unused-vars */
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
    const tierlist = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    const tiers = userstate["msg-param-sub-plan"];
    const ave = tierlist[tiers];
    // const recipient = ~~userstate["msg-param-recipient-user-name"];

    // message for Action
    client.clients.logger.log("info", `${username} gifted ${recipient} a subscription.`);
    client.say(channel, `/me ${username} hat ${recipient} einen ${ave} Sub geschenkt, vielen dank für deine Unterstützung !`);

    // this comes back as a boolean from twitch, disabling for now
    // "msg-param-sender-count": false
    // const senderCount = ~~userstate["msg-param-sender-count"];
    // client.clients.logger.log("info", `${username} has gifted ${senderCount} subs!`);
};