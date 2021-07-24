const { WriteStream } = require("fs")
const linkTest = new RegExp("(^|[ \t\r\n])((sftp|ftp|http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))", "g")
/**
 * @listens twitch:message
 * @param {TwitchClient} client
 * @param {string} target
 * @param {ChatUserstate} context
 * @param {string} msg
 * @param  {boolean} self
 */
exports.event = async (client, target, context, msg, self) => {
    switch (target[0]) {
        case "#":
            let channellog = client.channellogs[target.replace("#", "")]
            if (!channellog || !(channellog instanceof WriteStream)) {
                console.error("channellogs for channel " + target.slice(1) + " is not available!")
            } else {
                channellog.write(`[${(new Date()).toLocaleTimeString()}]${context["display-name"]}: ${msg}\n`)
            }
            break;
    }
    if (self) return; // Ignore messages from the bot
    let args = msg.trim().split(" ");
    checkModAction(client, msg, context, target, args)
    if (msg.startsWith("!")) {
        const commandName = args.shift().toLowerCase().slice(1);
        let cmd = client.commands.get(commandName)
        if (cmd) {
            if (cmd.perm && (hasPerm(context) == false)) {
                if (!cmd.silent) client.say(target, "Du hast keine Rechte!")
                return
            }
            if ((Date.now() - client.cooldowns.get(target.replace("#", ""))) > 1000 * client.config.Cooldown) {
                cmd.run(client, target, context, msg, self, args)
                console.log(`* Executed ${commandName} command`);
                client.cooldowns.set(target.replace("#", ""), Date.now())
            }
        } else {
            cmd = client.db.getCcmd(`!${commandName}`);
            if (!cmd) cmd = client.db.getCcmd(client.db.getAlias(`!${commandName}`))
            if (cmd) {
                client.say(target, cmd);
                console.log(`* Executed ${commandName} Customcommand`)
            } else {
                cmd = client.db.getCom(`!${commandName}`)
                if (cmd) {
                    if (!hasPerm(context)) return
                    client.say(target, cmd);
                    console.log(`* Executed ${commandName} Customcommand`)
                }
            }

        }
    }
}
function checkModAction(client, msg, ctx, target, args) {
    if (hasPerm(ctx)) return
    var message = msg.toLowerCase()
    var delbl = client.blacklist.get("delmsg")
    var checkmsg = ` ${message} `
    if (delbl.some((a) => checkmsg.includes(` ${a} `))) return client.deletemessage(target, ctx.id)
    if (checkmsg.includes(" www.")) {
        var links = args.filter((a)=> a.toLowerCase().includes("www"))
        var forbiddenlinks = links.filter((l)=> !(client.permittedlinks.some((purl) => l.toLowerCase().includes(purl))))
        if(forbiddenlinks.length>0) return client.deletemessage(target, ctx.id)
    }
    if (ctx["message-type"] == "action") return client.deletemessage(target, ctx.id)
    if (ctx.badges) if (ctx.badges["vip"]) return
    var urls = message.match(linkTest)
    if (!urls) return
    if (urls.length == 0) return
    if (urls.some((url) => !permittedlink(client, url))) return client.deletemessage(target, ctx.id)
}
function hasPerm(ctx) {
    if (ctx.mod) return true
    if (ctx.badges) if (ctx.badges["broadcaster"]) return true
    return false
}
function permittedlink(client, url) {
    return client.permittedlinks.some((purl) => url.includes(purl))
}