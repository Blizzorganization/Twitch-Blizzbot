exports.help = false
exports.alias = ["befehl", "command", "commands", "cmd"]
exports.run = (client, target, context, msg, self) => {
    let appHelp = client.commands.filter((cmd) => cmd.help).keyArray().join(", ")
    var ccmds = client.db.allCcmds()
    if (ccmds.length > 0) appHelp += `, ${ccmds.join(", ")}`
    client.say(target, `Der Bot kann folgende Commands: ${appHelp}`)
}
