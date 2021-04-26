exports.help = false
exports.perm = true
/**
 * @name addbl
 * @module TwitchCommands
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run =(client, target, context, msg, self, args) => {
    if (!args || args.length == 0) return client.say(target, "Du musst angeben, was du blockieren willst!")
    let blword = args.join(" ").toLowerCase()
    client.blacklist.push("delmsg", blword)
    client.say(target, `"${blword}" wurde in die Blacklist eingetragen TPFufun`)
    console.log(`* Added "${blword}" to Blacklist`)
}