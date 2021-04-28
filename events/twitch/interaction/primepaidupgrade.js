/**
 * @listens primepaidupgrade
 * @param {TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {string} sender
 * @param {SubUserstate} userstate
 */
exports.event = (client, channel, username, sender, userstate) => {
   //message for Action
   console.log(`${username} extended subcription`)
   client.say(channel, `/me ${username} hat seinen geschenkten Sub verlängert!`)
}