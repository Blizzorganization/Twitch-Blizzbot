exports.help = false
exports.perm = true
/**
 * @name ccmd
 * @module TwitchCommands
 * @param {TwitchClient} client 
 * @param {string} target 
 * @param {ChatUserstate} context 
 * @param {string} msg 
 * @param {boolean} self 
 */
exports.run = (client, target, context, msg, self) => {
    let appHelp = ""
    var coms = client.db.allComs()
    if (coms.length > 0) {
        appHelp = `Es sind folgende Commands hinterlegt: ${coms.join(", ")}`
    } else {
        appHelp = "Es sind keine Commands hinterlegt."
    }
    client.say(target, appHelp)
}
