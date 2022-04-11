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
    if (checkModAction(client, msg, context, target, args)) return;
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
 * @returns {boolean} whether the message forced a mod action
 */
function checkModAction(client, msg, ctx, target, args) {
    if (hasPerm(client, ctx)) return false;
    const message = msg.toLowerCase();
    const delbl = client.blacklist[target.replace(/#+/g, "")];
    const checkmsg = ` ${message} `;
    const blacklistMatches = delbl.filter((a) => checkmsg.includes(` ${a.blword} `));
    if (blacklistMatches.length > 0) {
        const action = Math.max(...blacklistMatches.map((a) => a.action));
        switch (action) {
            case 0:
                client.deletemessage(target, ctx.id);
                break;
            case 1:
                client.timeout(target, ctx.username, 10, "Blacklisted word"); // 10s
                break;
            case 2:
                client.timeout(target, ctx.username, 30, "Blacklisted word"); // 30s
                break;
            case 3:
                client.timeout(target, ctx.username, 42, "Blacklisted word"); // 42s
                break;
            case 4:
                client.timeout(target, ctx.username, 60, "Blacklisted word"); // 1m
                break;
            case 5:
                client.timeout(target, ctx.username, 300, "Blacklisted word"); // 5m
                break;
            case 6:
                client.timeout(target, ctx.username, 600, "Blacklisted word"); // 10m
                break;
            case 7:
                client.timeout(target, ctx.username, 1200, "Blacklisted word"); // 20m
                break;
            case 8:
                client.timeout(target, ctx.username, 1800, "Blacklisted word"); // 30m
                break;
            case 9:
                client.timeout(target, ctx.username, 3600, "Blacklisted word"); // 1h
                break;
            case 10:
                client.ban(
                    target,
                    ctx.id,
                    `Blacklisted word: ${blacklistMatches.find((match) => match.action === action).blword}`,
                );
                break;
            default:
                logger.warn(
                    `Unknown action ${action} for ${blacklistMatches.find((match) => match.action === action).blword}`,
                );
                break;
        }
        return true;
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
            return true;
        }
    }
    if (ctx["message-type"] == "action") {
        client.deletemessage(target, ctx.id);
        return true;
    }
    if (ctx.badges) if (ctx.badges["vip"]) return false;
    const urls = message.match(linkTest);
    if (!urls) return false;
    if (urls.length == 0) return false;
    if (urls.some((url) => !permittedlink(client, url))) {
        client.deletemessage(target, ctx.id);
        return true;
    }
    return false;
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
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
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
        if (Date.now() - client.cooldowns.get(target.replace("#", "")) > 1000 * client.config.Cooldown) {
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
        if (Date.now() - client.cooldowns.get(target.replace("#", "")) > 1000 * client.config.Cooldown) {
            response = await counters(client, ccmd.response, target);
            client.say(target, response);
            logger.log("command", `* Executed ${commandName} Customcommand`);
        }
        return;
    }
    const alias = await client.clients.db.resolveAlias(target, `!${commandName}`);
    if (alias) {
        if (alias.permissions > userpermission) return client.say(target, "Du hast keine Rechte");
        if (Date.now() - client.cooldowns.get(target.replace("#", "")) > 1000 * client.config.Cooldown) {
            response = await counters(client, alias.response, target);
            client.say(target, response);
            logger.log("command", `* Executed ${alias.command} caused by alias ${alias.alias}`);
        }
    }
}
