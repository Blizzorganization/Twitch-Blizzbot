exports.event = (client, channel, username, method, message, userstate) => {
    //message for Action
    console.log(` ${username} subscription`)
    client.say(channel, `/me Haaaaaalllooooo und Willkommen ${username} bei den Subscrizzors `)
}