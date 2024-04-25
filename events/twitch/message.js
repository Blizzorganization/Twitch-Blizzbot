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
    if (await checkModAction(client, msg, context, target, args)) return;
    if (msg.startsWith("!")) {
        await handleCommand(client, target, context, msg, self, args);
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
    if (!possibleCounters || possibleCounters.length <= 0) return response;
    for (const pc of possibleCounters) {
        if (!pc.startsWith("{counter:")) continue;
        const counter = pc.replace("{counter:", "").replace("}", "");
        const cdata = await client.clients.db.getCounter(target, counter);
        if (cdata) response = response.replace(pc, cdata.toString());
    }
    return response;
}
/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} msg
 * @param {import("tmi.js").ChatUserstate} ctx
 * @param {string} target
 * @param {string[]} args
 * @returns {Promise<boolean>} whether the message forced a mod action
 */
async function checkModAction(client, msg, ctx, target, args) {
    if (hasPerm(client, ctx)) return false;
    const message = msg.toLowerCase();
    const delbl = client.blacklist[target.replace(/#+/g, "")];
    const checkmsg = ` ${message} `;
    const blacklistMatches = delbl.filter((a) => checkmsg.includes(` ${a.blword} `));
    if (blacklistMatches.length > 0) {
        const action = Math.max(...blacklistMatches.map((a) => a.action));
        const blacklistActionTrigger = blacklistMatches.find((match) => match.action === action).blword;
        await executeModActionByLevel(action, client, target, ctx, blacklistActionTrigger);
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
            await client.deletemessage(target, ctx.id);
            return true;
        }
    }
    if (ctx["message-type"] == "action") {
        await client.deletemessage(target, ctx.id);
        return true;
    }
    if (ctx.badges) if (ctx.badges["vip"]) return false;
    const urls = message.match(linkTest);
    if (!urls) return false;
    if (urls.length == 0) return false;
    if (urls.some((url) => !permittedlink(client, url))) {
        await client.deletemessage(target, ctx.id);
        return true;
    }
    return false;
}

/**
 * @param {number} action
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} ctx
 * @param {string} blacklistActionTrigger
 */
async function executeModActionByLevel(action, client, target, ctx, blacklistActionTrigger) {
    switch (action) {
        case 0:
            await client.deletemessage(target, ctx.id);
            break;
        case 1:
            await client.timeout(target, ctx.username, 10, "Blacklisted word"); // 10s
            break;
        case 2:
            await client.timeout(target, ctx.username, 30, "Blacklisted word"); // 30s
            break;
        case 3:
            await client.timeout(target, ctx.username, 42, "Blacklisted word"); // 42s
            break;
        case 4:
            await client.timeout(target, ctx.username, 60, "Blacklisted word"); // 1m
            break;
        case 5:
            await client.timeout(target, ctx.username, 300, "Blacklisted word"); // 5m
            break;
        case 6:
            await client.timeout(target, ctx.username, 600, "Blacklisted word"); // 10m
            break;
        case 7:
            await client.timeout(target, ctx.username, 1200, "Blacklisted word"); // 20m
            break;
        case 8:
            await client.timeout(target, ctx.username, 1800, "Blacklisted word"); // 30m
            break;
        case 9:
            await client.timeout(target, ctx.username, 3600, "Blacklisted word"); // 1h
            break;
        case 10:
            await client.ban(target, ctx.id, `Blacklisted word: ${blacklistActionTrigger}`);
            break;
        default:
            logger.warn(`Unknown action ${action} for ${blacklistActionTrigger}`);
            break;
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
    if (client.config.permit) {
        if (client.permitList.includes(ctx.username)) return permissions.mod;
    } else if (ctx.mod) {
        return permissions.mod;
    }

    if (ctx.subscriber) return permissions.sub;
    return permissions.user;
}
/**
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} url
 * @returns {boolean} whether the link is allowed to be sent
 */
function permittedlink(client, url) {
    return client.permittedlinks.some((purl) => url.includes(purl));
}
/**
 *
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 * @param {string} commandName
 * @param {number} userPermission
 * @returns {Promise<boolean>} whether there was a command.
 */
async function handleInternalCommand(client, target, context, msg, self, args, commandName, userPermission) {
    const userHasModPermission = userPermission >= permissions.mod;
    const timeSinceLastExecution = Date.now() - client.cooldowns.get(target.replace("#", ""));
    const cmd = client.commands.get(commandName);
    if (!cmd) return false;
    let cmdPerm = cmd.perm;
    const dbCommandState = await client.clients.db.resolveCommand(target, commandName);
    if (dbCommandState) {
        if (dbCommandState.enabled === false) {
            logger.debug("Command disabled via database.");
            return true;
        }
        if (dbCommandState.permission === -1) cmdPerm = cmd.perm;
    }
    if (cmd.perm && userPermission < cmdPerm) {
        if (commandName === "!") return true;
        if (!cmd.silent) await client.say(target, "Du hast keine Rechte");
        logger.error("Permission requirements of the user not met.");
        return true;
    }
    if (!userHasModPermission && timeSinceLastExecution <= 1000 * client.config.Cooldown) {
        logger.debug("Cooldown hit!");
        return true;
    }
    try {
        await cmd.run(client, target, context, msg, self, args);
        logger.debug(`* Executed ${commandName} command`);
        return true;
    } catch (e) {
        /** @type {Error} */
        let errorObject;
        if (e && e instanceof Error) {
            errorObject = e;
        } else {
            errorObject = new Error(e);
        }
        logger.error(`* Execution of command ${commandName} failed: ${errorObject.message}`);
        return true;
    } finally {
        client.cooldowns.set(target.replace("#", ""), Date.now());
    }
}

/**
 *
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 * @param {string} commandName
 * @param {number} userPermission
 * @returns {Promise<boolean>} whether there was a command.
 */
async function handleCustomCommand(client, target, context, msg, self, args, commandName, userPermission) {
    const ccmd = await client.clients.db.getCcmd(target, `!${commandName}`);
    const timeSinceLastExecution = Date.now() - client.cooldowns.get(target.replace("#", ""));
    const userHasModPermission = userPermission >= permissions.mod;

    /** @type {string} */
    let response;
    if (ccmd) {
        if (ccmd.permissions > userPermission) {
            await client.say(target, "Du hast keine Rechte für diesen Command");
            return true;
        }
        if (!userHasModPermission && timeSinceLastExecution <= 1000 * client.config.Cooldown) {
            logger.debug("Cooldown hit!");
            return true;
        }

        response = await counters(client, ccmd.response, target);
        await client.say(target, response);
        logger.debug(`* Executed Custom Command ${commandName}`);

        return true;
    }
    const alias = await client.clients.db.resolveAlias(target, `!${commandName}`);
    if (!alias) return false;

    if (alias.permissions > userPermission) {
        await client.say(target, "Du hast keine Rechte");
        return true;
    }
    if (!userHasModPermission && timeSinceLastExecution <= 1000 * client.config.Cooldown) {
        logger.debug("Cooldown hit");
        return true;
    }
    response = await counters(client, alias.response, target);
    await client.say(target, response);
    logger.debug(`* Executed Custom Command ${alias.command} caused by Alias ${alias.alias}`);
    return true;
}

/**
 *
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function handleCommand(client, target, context, msg, self, args) {
    const commandName = args.shift()?.toLowerCase().slice(1);
    if (!commandName || commandName === "") return;
    logger.debug(`Trying to execute command ${commandName} for ${context.username}`);
    const userPermission = hasPerm(client, context);

    const executedCommand = await handleInternalCommand(
        client,
        target,
        context,
        msg,
        self,
        args,
        commandName,
        userPermission,
    );
    if (executedCommand) return;
    logger.debug("Command not found - looking for a customcommand");
    const executedCustomCommand = await handleCustomCommand(
        client,
        target,
        context,
        msg,
        self,
        args,
        commandName,
        userPermission,
    );
    if (executedCustomCommand) return;
    logger.debug(`Did not find a command or customcommand for ${commandName}`);
}
