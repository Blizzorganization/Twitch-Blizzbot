exports.help = false
exports.perm = true
exports.run =(client, target, context, msg, self, args) => {
    if (args.length == 0) return
    client.db.delCcmd(args[0])
    client.say(target, `Befehl ${args[0]} wurde gelöscht.`)
    console.log(`* Deleted Customcommand ${args[0]}`)
}