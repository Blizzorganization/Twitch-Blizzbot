module.exports = (client, channel, username, streakMonths, recipient, methods, userstate) => {
    let senderCount = ~~userstate["msg-param-sender-count"];
    
//message for Action
    console.log(` ${username} giftet ${recipient} subscription.`)
    client.say(channel, `/me ${username} hat ${recipient} einen Sub geschenkt.`)
}