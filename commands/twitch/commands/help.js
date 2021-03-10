exports.help = false
exports.alias = ["befehl", "command", "commands", "cmd"]
exports.run = (client, target, context, msg, self) => {
    let appHelp = client.cmds.join(", ")
    if (client.ccmds.keyArray().length > 0) appHelp += `, ${client.ccmds.keyArray().join(", ")}`
    client.say(target, `Der Bot kann folgende Commands: ${appHelp}`)
}
