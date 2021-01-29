exports.help = false
exports.run = (client, target, context, msg, self, args) => {
  if (!context.mod) return client.say(target, "Du hast keine Rechte!")
  if (args.length>1) {
    let newcmd = args.shift().toLowerCase()
    let res = args.join(" ")
    if (!res||res=="") return client.say(target, "Du musst angeben, was die Antwort sein soll.")
    client.ccmds.set(newcmd, res)
    client.say(target, `Befehl ${newcmd} wurde hinzugefügt.`)
    console.log(`* Added Customcommand ${newcmd}`)
  } else {
    client.say(target, "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest.")
  }
}
