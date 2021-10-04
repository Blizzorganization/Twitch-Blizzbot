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
            {
                const channellog = client.channellogs[target.replace("#", "")];
                if (!channellog || !(channellog instanceof WriteStream)) {
                    client.clients.logger.error("channellogs for channel " + target.slice(1) + " is not available!");
                } else {
                    channellog.write(`[${(new Date()).toLocaleTimeString()}]${context["display-name"]}: ${msg}\n`);
                }
            }
            break;
    }
    // Ignore messages from the bot
    if (self) return;
    const args = msg.trim().split(" ");
    const userpermission = hasPerm(client, context);
    checkModAction(client, msg, context, target, args);
    if (msg.startsWith("!")) {
        const commandName = args.shift().toLowerCase().slice(1);
        const cmd = client.commands.get(commandName);
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
            const ccmd = await client.clients.db.getCcmd(target, `!${commandName}`);
            let response;
            if (ccmd) {
                if (ccmd.permissions > userpermission) return client.say(target, "Es bleibt alles so wie es ist, ob du hier bist und nicht. [Du hast keine Rechte]");
                response = await counters(client, ccmd.response, target);
                client.say(target, response);
                client.clients.logger.log("command", `* Executed ${commandName} Customcommand`);
            } else {
                const alias = await client.clients.db.resolveAlias(target, `!${commandName}`);
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
    const possibleCounters = response.match(counterTest);
    if (possibleCounters && possibleCounters.length > 0) {
        for (const pc of possibleCounters) {
            if (!pc.startsWith("{counter:")) return;
            const counter = pc.replace("{counter:", "").replace("}", "");
            const cdata = await client.clients.db.getCounter(target, counter);
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
 * @param {string[]} args
 */
function checkModAction(client, msg, ctx, target, args) {
    if (hasPerm(client, ctx)) return;
    const message = msg.toLowerCase();
    const delbl = client.blacklist[target.replace(/#+/g, "")];
    const checkmsg = ` ${message} `;
    if (delbl.some((a) => checkmsg.includes(` ${a} `))) return client.deletemessage(target, ctx.id);
    if (checkmsg.includes(" www.")) {
        const links = args.filter((a) => a.toLowerCase().includes("www"));
        const forbiddenlinks = links.filter((l) => !(client.permittedlinks.some((purl) => l.toLowerCase().includes(purl))));
        if (forbiddenlinks.length > 0) return client.deletemessage(target, ctx.id);
    }
    if (ctx["message-type"] == "action") return client.deletemessage(target, ctx.id);
    if (ctx.badges) if (ctx.badges["vip"]) return;
    const urls = message.match(linkTest);
    if (!urls) return;
    if (urls.length == 0) return;
    if (urls.some((url) => !permittedlink(client, url))) return client.deletemessage(target, ctx.id);
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
    return client.permittedlinks.some((purl) => url.includes(purl));
}