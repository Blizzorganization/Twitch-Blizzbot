exports.help = false
exports.alias = ["befehl", "command", "commands", "cmd"]
/**
 * @name help
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = (client, target, context, msg, self) => {
    let appHelp = "!" + client.commands.filter((cmd) => cmd.help).keyArray().join(", !")
    var ccmds = client.db.allCcmds()
    if (ccmds.length > 0) appHelp += `, ${ccmds.join(", ")}`
    client.say(target, `Der Bot kann folgende Commands: ${appHelp}`)
}
