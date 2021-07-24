/**
 * @listens subgift
 * @param  {TwitchClient} client
 * @param  {string} channel
 * @param  {string} username
 * @param  {number} streakMonths
 * @param  {string} recipient
 * @param  {SubMethod} methods
 * @param  {SubUserstate} userstate
 */
exports.event = (client, channel, username, streakMonths, recipient, methods, userstate) => {
    let senderCount = ~~userstate["msg-param-sender-count"];

    //message for Action
    console.log(`${username} gifted ${recipient} a subscription.`)
    /*client.say(channel, `/me Danke ${username} hat bereits ${senderCount} Subs verschenkt.`)
    */
}