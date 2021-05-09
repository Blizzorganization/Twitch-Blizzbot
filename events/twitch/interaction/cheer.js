/**
 * @listens cheer
 * @param {TwitchClient} client
 * @param {string} channel
 * @param {ChatUserstate} userstate
 * @param {string} message
 */
exports.event = (client, channel, userstate, message) => {
    
    //message for Action
    console.log(` ${userstate.username} cheered ${userstate.bits} bits`)
    client.say(channel, `/me Danke ${userstate.username} für die ${userstate.bits} bits!`)
}