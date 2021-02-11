exports.help = false
exports.perm = true
exports.run = (client, target, context, msg, self, args) => {
  if (!args||args.lenth==0) return client.say(target, "Du musst angeben, was du von der Blacklist entfernen willst!")
  let blremove = args.join().toLowerCase()
  if (!client.blacklist.includes("delmsg", blremove)) return client.say(target, `"${blremove}" wird nicht gelöscht, kann also auch nicht aus der Blacklist entfernt werden.`)
  client.blacklist.remove("delmsg", blremove)
  client.say(target, `"${blremove}" wurde von der Blacklist entfernt`)
  console.log(`* Remove "${blword}" from Blacklist`)
}
