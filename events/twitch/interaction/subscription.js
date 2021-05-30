/**
 * @listens twitch:subscription
 * @param {TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {SubMethod} method
 * @param {string} message
 * @param {SubUserstates} userstate
 */
exports.event = (client, channel, username, method, message, userstate) => {

    const tierlist = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3', Prime: 'Twitch Prime' };
    let tiers = userstate['msg-param-sub-plan']
    let ave = tierlist[tiers]

    //message for Action
    console.log(` ${username} subscription`)
    client.say(channel, `/me Haaaaaalllooooo und Willkommen ${username} bei den Subscrizzors mit deinem ${ave} Sub`)
}