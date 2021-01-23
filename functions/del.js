exports.help = false
exports.run = (client, target, context, msg, self, args) => {
  if (!context.mod) return client.say(target, "Du hast keine Rechte!")
  if (args.length==0) return
  if (client.ccmds.has(args[0])) {
    client.ccmds.delete(args[0])
    client.aliases.keyArray().forEach(k => {if (client.aliases.get("k")==args[0]) client.aliases.delete(k)})
    client.say(target, `Befehl ${args[0]} wurde gelöscht.`)
    console.log(`* Deleted Customcommand ${args[0]}`)
  }
}
