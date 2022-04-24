import { WriteStream } from "fs";
import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

const linkTest = new RegExp(
    // eslint-disable-next-line no-control-regex
    "(^|[ \t\r\n])((sftp|ftp|http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))",
    "g",
);
const counterTest = new RegExp(/\{(.*?)\}/g);

/**
 *
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
export async function event(client, target, context, msg, self) {
    switch (target[0]) {
        case "#":
            {
                const channellog = client.channellogs[target.replace("#", "")];
                if (!channellog || !(channellog instanceof WriteStream)) {
                    logger.error(`channellogs for channel ${target.slice(1)} is not available!`);
                } else {
                    channellog.write(`[${new Date().toLocaleTimeString()}]${context["display-name"]}: ${msg}\n`);
                }
            }
            break;
    }
    // Ignore messages from the bot
    if (self) return;
    const args = msg.trim().split(" ");
    checkModAction(client, msg, context, target, args);
    if (msg.startsWith("!")) {
        handleCommand(client, target, context, msg, self, args);
    }
}
/**
 * @async
 * @description resolves counters in customcommands
 * @param  {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param  {string} response
 * @param  {string} target
 * @returns {Promise<string>} the response with resolved counters
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
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} msg
 * @param {import("tmi.js").ChatUserstate} ctx
 * @param {string} target
 * @param {string[]} args
 */
function checkModAction(client, msg, ctx, target, args) {
    if (hasPerm(client, ctx)) return;
    const message = msg.toLowerCase();
    const delbl = client.blacklist[target.replace(/#+/g, "")]["0"];
    const checkmsg = ` ${message} `;
    if (delbl.some((a) => checkmsg.includes(` ${a} `))) {
        client.deletemessage(target, ctx.id);
        return;
    }
    if (checkmsg.includes(" www.") || client.deletelinks.some((tld) => checkmsg.includes(tld))) {
        const links = args.filter(
            (a) => a.toLowerCase().includes("www") || client.deletelinks.some((tld) => a.includes(tld)),
        );
        const forbiddenlinks = links.filter(
            (l) => !client.permittedlinks.some((purl) => l.toLowerCase().includes(purl)),
        );
        if (forbiddenlinks.length > 0) {
            client.deletemessage(target, ctx.id);
            return;
        }
    }
    if (ctx["message-type"] == "action") {
        client.deletemessage(target, ctx.id);
        return;
    }
    if (ctx.badges) if (ctx.badges["vip"]) return;
    const urls = message.match(linkTest);
    if (!urls) return;
    if (urls.length == 0) return;
    if (urls.some((url) => !permittedlink(client, url))) {
        client.deletemessage(target, ctx.id);
        return;
    }
}
/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {import("tmi.js").ChatUserstate} ctx
 * @returns {permissions} a permission
 */
function hasPerm(client, ctx) {
    if (client.config.devs.includes(ctx.username)) return permissions.dev;
    if (ctx.badges) {
        if (ctx.badges["broadcaster"]) return permissions.streamer;
        if (ctx.badges["vip"]) return permissions.vip;
    }
    if (ctx.mod) return permissions.mod;
    if (ctx.subscriber) return permissions.sub;
    return permissions.user;
}
/**
 * @param {{ permittedlinks: string[]; }} client
 * @param {string} url
 * @returns {boolean} whether the link is allowed to be sent
 */
function permittedlink(client, url) {
    return client.permittedlinks.some((purl) => {
        return url.includes(purl);
    });
}

/**
 *
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
async function handleCommand(client, target, context, msg, self, args) {
    const userpermission = hasPerm(client, context);
    const commandName = args.shift().toLowerCase().slice(1);
    const cmd = client.commands.get(commandName);
    if (cmd) {
        let cmdPerm = cmd.perm;
        const dbCommandState = await client.clients.db.resolveCommand(target, commandName);
        if (dbCommandState) {
            if (dbCommandState.enabled === false) return;
            if (dbCommandState.permission === -1) cmdPerm = cmd.perm;
        }
        if (cmd.perm && userpermission < cmdPerm) {
            if (!cmd.silent) client.say(target, "Du hast keine Rechte");
            return;
        }
        if (
            userpermission >= permissions.mod ||
            Date.now() - client.cooldowns.get(target.replace("#", "")) > 1000 * client.config.Cooldown
        ) {
            cmd.run(client, target, context, msg, self, args);
            logger.log("command", `* Executed ${commandName} command`);
            client.cooldowns.set(target.replace("#", ""), Date.now());
        }
        return;
    }
    const ccmd = await client.clients.db.getCcmd(target, `!${commandName}`);
    let response;
    if (ccmd) {
        if (ccmd.permissions > userpermission) return client.say(target, "Du hast keine Rechte für diesen Command");
        if (
            userpermission >= permissions.mod ||
            Date.now() - client.cooldowns.get(target.replace("#", "")) > 1000 * client.config.Cooldown
        ) {
            response = await counters(client, ccmd.response, target);
            client.say(target, response);
            logger.log("command", `* Executed ${commandName} Customcommand`);
        }
        return;
    }
    const alias = await client.clients.db.resolveAlias(target, `!${commandName}`);
    if (alias) {
        if (alias.permissions > userpermission) return client.say(target, "Du hast keine Rechte");
        if (
            userpermission >= permissions.mod ||
            Date.now() - client.cooldowns.get(target.replace("#", "")) > 1000 * client.config.Cooldown
        ) {
            response = await counters(client, alias.response, target);
            client.say(target, response);
            logger.log("command", `* Executed ${alias.command} caused by alias ${alias.alias}`);
        }
    }
}
