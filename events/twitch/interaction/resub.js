exports.event = (client, channel, username, months, message, userstate, methods) => {
    const tierList = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3' };
    let cumulativeMonths = userstate['msg-param-cumulative-months'];
    let streakMonths = userstate['msg-param-steak-Months'];
    let sharedStreak = userstate['msg-param-should-share-streak'];
    let resubmessage = (message != null)
    if (sharedStreak) {
        client.say(channel, `/me Vielen Dank ${username} für einen ${sharedStreak} in Folge! ${message}`);
    }
    else {
        client.say(channel, `/me Danke ${username} für deinen insgesamt ${cumulativeMonths}. Monat${resubmessage ? " Mit der Nachricht: " + message : ""}.`)
    }
    console.log(` ${username} resub ${cumulativeMonths}. month`)
}