exports.event = (client, channel, username, viewers) => {
    //message for Action
    console.log(` ${username} raid ${viewers} viewer!`)
    client.say(channel, `/me ${username} Raidet mit ${viewers} Zuschauer!`)
}