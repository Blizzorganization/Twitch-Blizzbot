exports.help = false
exports.run = (client, target, context, msg, self, args) => {
  if (!context.mod) return
  client.discord.channel.send(`In der Blacklist für ${target} sind die Wörter \`\`\`fix\n${client.blacklist.get("delmsg").join("\n")}\`\`\` enthalten.`, {split:true})
  console.log(`* Sent the blacklist to ${context.username}`)
}
