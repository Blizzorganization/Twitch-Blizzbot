exports.event = (client, channel, username, sender, userstate) => {
    //message for Action
    console.log(`${username} extended subcription`)
    client.say(channel, `/me ${username} hat seinen geschenkten Sub verlängert!`)
}