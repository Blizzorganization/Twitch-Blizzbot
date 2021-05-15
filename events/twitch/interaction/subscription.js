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

    //message for Action
    console.log(` ${username} subscription`)
    client.say(channel, `/me Haaaaaalllooooo und Willkommen ${username} bei den Subscrizzors `)
}