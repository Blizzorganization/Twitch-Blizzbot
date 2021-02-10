module.exports = async (client, target, context, msg, self) => {
    if (self) return; // Ignore messages from the bot
    let args = msg.trim().split(" ");
    checkModAction(client, msg, context, target)
    const commandName = args.shift().toLowerCase();
    let cmd = client.commands.get(commandName)
    if (cmd) {
        if (cmd.perm &&(hasPerm(context)==false)) {
            if (!cmd.silent) client.say(target, "Du hast keine Rechte!")
            return 
        }
        cmd.run(client, target, context, msg, self, args)
        console.log(`* Executed ${commandName} command`);
    } else {
        cmd = client.ccmds.get(commandName);
        if (!cmd) cmd = client.ccmds.get(client.aliases.get(commandName))
        if (cmd) {
            client.say(target, cmd);
            console.log(`* Executed ${commandName} Customcommand`)
        }
    }
}
function checkModAction(client, msg, ctx, target) {
    if (hasPerm(ctx)) return
    let message = msg.toLowerCase()
    let delbl = client.blacklist.get("delmsg")
    checkmsg = ` ${message} `
    if (delbl.some((a) => checkmsg.includes(` ${a} `))) client.deletemessage(target, ctx.id)
}
function hasPerm(ctx) {
    if (ctx.mod) return true
    if (ctx.badges) if (ctx.badges["broadcaster"]) return true
    return false
}