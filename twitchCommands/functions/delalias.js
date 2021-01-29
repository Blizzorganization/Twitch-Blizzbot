exports.help = false
exports.run = (client, target, context, msg, self, args) => {
  if (!context.mod) return client.say(target, "Du hast keine Rechte!")
  if (args.length==0) return
  if (client.aliases.has(args[0])) {
    client.aliases.delete(args[0])
    client.say(target, `Alias ${args[0]} wurde entfernt.`)
    console.log(`* Deleted alias ${args[0]}`)
  }
}
