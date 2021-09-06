/**
 * @listens twitch:subscription
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {import("tmi.js").SubMethod} method
 * @param {string} message
 * @param {import("tmi.js").SubUserstate} userstate
 */
exports.event = (client, channel, username, method, message, userstate) => {
    const tierlist = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    let tiers = userstate["msg-param-sub-plan"];
    let ave = tierlist[tiers];

    //message for Action
    client.clients.logger.log("info", `${username} subscription`);
    client.say(channel, `/me Haaaaaallloooooo und Willkommen ${username} bei den Subscrizzors mit deinem ${ave} Sub`);
};