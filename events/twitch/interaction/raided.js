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
    if (viewers<10) return;
    client.say(channel, `/me ${username} Raidet mit ${viewers} Zuschauer!`)
}