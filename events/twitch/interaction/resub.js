/**
 * @listens resub
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} months
 * @param {string} message
 * @param {import("tmi.js").SubUserstate} userstate
 */
exports.event = (client, channel, username, months, message, userstate) => {
    const tierlist = { 1000: "Tier 1", 2000: "Tier 2", 3000: "Tier 3", Prime: "Twitch Prime" };
    let cumulativeMonths = userstate["msg-param-cumulative-months"];
    let tiers = userstate["msg-param-sub-plan"];
    let resubmessage = (message != null);
    let ave = tierlist[tiers];

    //message for Action
    client.clients.logger.log("info", `${username} resub ${cumulativeMonths}. month`);
    client.say(channel, `/me Danke ${username} für deinen ${ave} Sub im insgesamt ${cumulativeMonths}. Monat${resubmessage ? " Mit der Nachricht: " + message : ""}.`);
};