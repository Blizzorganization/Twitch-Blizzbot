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
    const tierList = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3' };
    let cumulativeMonths = userstate['msg-param-cumulative-months'];
    let streakMonths = userstate['msg-param-steak-Months'];
    let sharedStreak = userstate['msg-param-should-share-streak'];
    let resubmessage = (message != null)
    
    //message for Action
    client.say(channel, `/me Danke ${username} fÃ¼r deinen insgesamt ${cumulativeMonths}. Monat${resubmessage ? " Mit der Nachricht: " + message : ""}.`)
    console.log(` ${username} resub ${cumulativeMonths}. month`)
}
