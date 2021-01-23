exports.help = false
exports.run = (client, target, context, msg, self, args) => {
  if (!context.mod) return client.say(target, "Du hast keine Rechte!")
  if (!args||args.lenth==0) return client.say(target, "Du musst angeben, was du blockieren willst!")
  let blword = args.join(" ").toLowerCase()
  client.blacklist.push("delmsg", blword)
  client.say(target, `"${blword}" wurde in die Blacklist eingetragen TPFufun`)
  console.log(`* Added "${blword}" to Blacklist`)
}
