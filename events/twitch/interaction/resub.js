/**
 * @listens resub
 * @param {TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} months
 * @param {string} message
 * @param {SubUserstate} userstate
 * @param {SubMethods} methods
 */
exports.event = (client, channel, username, months, message, userstate, methods) => {
    const tierlist = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3', Prime: 'Prime' };
    let cumulativeMonths = userstate['msg-param-cumulative-months'];
    let streakMonths = userstate['msg-param-steak-Months'];
    let sharedStreak = userstate['msg-param-should-share-streak'];
    let tiers = userstate['msg-param-sub-plan'];
    let resubmessage = (message != null);
    let ave = tierlist[tiers]

    //message for Action
    console.log(` ${username} resub ${cumulativeMonths}. month`)
    client.say(channel, `/me Danke ${username} für deinen ${ave} Sub im insgesamt ${cumulativeMonths}. Monat${resubmessage ? " Mit der Nachricht: " + message : ""}.`)
}