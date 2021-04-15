exports.help = false
exports.perm = true
exports.silent = true
exports.run =(client, target, context, msg, self, args) => {
    client.clients.discord.blchannel.send(`In der Blacklist für ${target} sind die Wörter \
    \`\`\`fix\n${client.blacklist.get("delmsg").join("\n")}\`\`\` enthalten.`, { split: true })
    console.log(`* Sent the blacklist to ${context.username}`)
}