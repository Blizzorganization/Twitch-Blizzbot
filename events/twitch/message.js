const { WriteStream } = require("fs");
const { permissions } = require("../../modules/constants");
// eslint-disable-next-line no-control-regex
const linkTest = new RegExp("(^|[ \t\r\n])((sftp|ftp|http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))", "g");
const counterTest = new RegExp(/\{(.*?)\}/g);

/**
 * 
 * @param {import("../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.event = async (client, target, context, msg, self) => {
    switch (target[0]) {
        case "#":
            var channellog = client.channellogs[target.replace("#", "")];
            if (!channellog || !(channellog instanceof WriteStream)) {
                client.clients.logger.error("channellogs for channel " + target.slice(1) + " is not available!");
            } else {
                channellog.write(`[${(new Date()).toLocaleTimeString()}]${context["display-name"]}: ${msg}\n`);
            }
            break;
    }
    if (self) return; // Ignore messages from the bot
    let args = msg.trim().split(" ");
    const userpermission = hasPerm(client, context);
    checkModAction(client, msg, context, target, args);
    if (msg.startsWith("!")) {
        const commandName = args.shift().toLowerCase().slice(1);
        let cmd = client.commands.get(commandName);
        if (cmd) {
            if (cmd.perm && (hasPerm(client, context) < cmd.perm)) {
                if (!cmd.silent) client.say(target, "Du hast keine Rechte");
                return;
            }
            if ((Date.now() - client.cooldowns.get(target.replace("#", ""))) > 1000 * client.config.Cooldown) {
                cmd.run(client, target, context, msg, self, args);
                client.clients.logger.log("command", `* Executed ${commandName} command`);
                client.cooldowns.set(target.replace("#", ""), Date.now());
            }
        } else {
            let ccmd = await client.clients.db.getCcmd(target, `!${commandName}`);
            let response;
            if (ccmd) {
                if (ccmd.permissions > userpermission) return client.say(target, "Es bleibt alles so wie es ist, ob du hier bist und nicht. [Du hast keine Rechte]");
                response = await counters(client, ccmd.response, target);
                client.say(target, response);
                client.clients.logger.log("command", `* Executed ${commandName} Customcommand`);
            } else {
                let alias = await client.clients.db.resolveAlias(target, `!${commandName}`);
                if (alias) {
                    if (alias.permissions > userpermission) return client.say(target, "Du denkst doch nicht wirklich das du das darfst");
                    response = await counters(client, alias.response, target);
                    client.say(target, response);
                    client.clients.logger.log("command", `* Executed ${alias.command} caused by alias ${alias.alias}`);
                }
            }
        }
    }
};
/**
 * @async counters
 * @description resolves counters in customcommands
 * @param  {import("../../modules/twitchclient").TwitchClient} client
 * @param  {string} response
 * @param  {string} target
 * @returns {Promise<string>}
 */
async function counters(client, response, target) {
    let possibleCounters = response.match(counterTest);
    if (possibleCounters && possibleCounters.length > 0) {
        for (const pc of possibleCounters) {
            if (!pc.startsWith("{counter:")) return;
            let counter = pc.replace("{counter:", "").replace("}", "");
            let cdata = await client.clients.db.getCounter(target, counter);
            if (cdata) response = response.replace(pc, cdata.toString());
        }
    }
    return response;
}
/**
 * @param {import("../../modules/twitchclient").TwitchClient} client
 * @param {string} msg
 * @param {import("tmi.js").ChatUserstate} ctx
 * @param {string} target
 * @param {any[]} args
 */
function checkModAction(client, msg, ctx, target, args) {
    if (hasPerm(client, ctx)) return;
    var message = msg.toLowerCase();
    var delbl = client.blacklist[target.replace(/#+/g, "")];
    var checkmsg = ` ${message} `;
    if (delbl.some((/** @type {string} */ a) => checkmsg.includes(` ${a} `))) return client.deletemessage(target, ctx.id);
    if (checkmsg.includes(" www.")) {
        var links = args.filter((/** @type {string} */ a) => a.toLowerCase().includes("www"));
        var forbiddenlinks = links.filter((/** @type {string} */ l) => !(client.permittedlinks.some((/** @type {any} */ purl) => l.toLowerCase().includes(purl))));
        if (forbiddenlinks.length > 0) return client.deletemessage(target, ctx.id);
    }
    if (ctx["message-type"] == "action") return client.deletemessage(target, ctx.id);
    if (ctx.badges) if (ctx.badges["vip"]) return;
    var urls = message.match(linkTest);
    if (!urls) return;
    if (urls.length == 0) return;
    if (urls.some((/** @type {any} */ url) => !permittedlink(client, url))) return client.deletemessage(target, ctx.id);
}
/**
 * @param {import("../../modules/twitchclient").TwitchClient} client
 * @param {import("tmi.js").ChatUserstate} ctx
 * @returns {number}
 */
function hasPerm(client, ctx) {
    if (client.config.devs.includes(ctx.username)) return permissions.dev;
    if (ctx.badges) if (ctx.badges["broadcaster"]) return permissions.streamer;
    if (ctx.mod) return permissions.mod;
    if (ctx.subscriber) return permissions.sub;
    return permissions.user;
}
/**
 * @param {{ permittedlinks: string[]; }} client
 * @param {string[]} url
 */
function permittedlink(client, url) {
    return client.permittedlinks.some((/** @type {string} */ purl) => url.includes(purl));
}