module.exports = (client, channel, username, _months, message, userstate, methods) => {
    const tierList = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3' };
    let cumulativeMonths = userstate['msg-param-cumulative-months'];
    let streakMonths = userstate['msg-param-steak-Months'];
    let sharedStreak = userstate['msg-param-should-share-streak'];
    //message for Action 
    client.say(channel, `/me Danke ${username} für deinen insgesamt ${cumulativeMonths}. Monat.`)
    if (message != null) {
        client.say(channel, `Mit der Nachricht: ${message}`)
    }
    console.log(` ${username} resub ${cumulativeMonths}. month`)
}
