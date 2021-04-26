/**
 * @listens raided
 * @param {TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} viewers
 */
exports.event = (client, channel, username, viewers) => {
    //message for Action
    console.log(` ${username} raid ${viewers} viewer!`)
    client.say(channel, `/me ${username} Raidet mit ${viewers} Zuschauer!`)
}