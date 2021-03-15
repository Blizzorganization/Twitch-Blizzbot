module.exports = (client, channel, userstate, message) => {

//message for Action
    console.log(` ${userstate.username} cheered ${userstate.bits} bits`)
    client.say(channel, `/me Danke ${userstate.username} für die ${userstate.bits} bits!`)
}