exports.help = false
exports.perm = true
exports.run = (client, target, context, msg, self) => {
    let appHelp = ""
    if (client.coms.keyArray().length > 0) {
        appHelp = `Es sind folgende Commands hinterlegt: ${client.coms.keyArray().join(", ")}`
    } else {
        appHelp = "Es sind keine Commands hinterlegt."
    }
    client.say(target, appHelp)
}
