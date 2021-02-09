const fetch = require("tmi.js")
exports.help = false
exports.perm = true
exports.run = async (client, target, context, msg, self) => {
    let minutes = client.config.minutes
    setTimeout(Ende, 60000*minutes)

    client.say(target, `/me Der Follower Modus wurde für die nächsten ${minutes} Minuten deaktiviert.`)
    client.say(target, `/followersoff`)

    setTimeout (Ende, 60*minutes*1000);
    function Ende()
    {
        client.say(target, `/followers 0`)
        client.say(target, `/me Der Follower Modus wurde Aktiviert.`) 
    }
}