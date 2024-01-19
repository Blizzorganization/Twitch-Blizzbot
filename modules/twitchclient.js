import { Collection } from "discord.js";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "fs";
import { scheduleJob } from "node-schedule";
import { Client } from "tmi.js";
import { loadCommands, loadEvents } from "./functions.js";
import { logger } from "./logger.js";
/**
 * @typedef configExtension
 * @property {number} Cooldown
 * @property {number} automessagedelay
 * @property {string[]} devs
 * @property {number} Raidminutes
 * @property {string} clientId
 * @property {boolean} permit
 * @typedef {configExtension & import("tmi.js").Options} config
 */

/**
 * @typedef {{[key: `${number}`]: string[]}} blacklist
 */

/**
 * TwitchClient
 * @class TwitchClient
 * @augments {Client}
 */
export class TwitchClient extends Client {
    /** @param {config} opts */
    constructor(opts) {
        super(opts);
        this.config = opts;
        this.started = false;
        /** @type {Collection<string, import("../typings/twitchcommand.ts").TwitchCommand>} */
        this.commands = new Collection();
        /** @type {string[]}*/
        this.helplist = [];
        /** @type {string[]}*/
        this.channels = [];
        this.permittedlinks = parsePermittedLinks();
        this.deletelinks = parseTLDs();
        this.permitList = parsePermitList();
        /** @type {ReturnType<typeof setInterval>|undefined} */
        this.watchtime = undefined;
        /** @type {ReturnType<typeof setInterval>|undefined} */
        this.automessage = undefined;
        /** @type {import("./clients.js").Clients}*/
        // @ts-expect-error -- late-init
        this.clients = undefined;
        /** @type {Record<string, import("../typings/dbtypes.js").Blacklist[]>}*/
        this.blacklist = undefined;
        if (!existsSync("./channellogs")) mkdirSync("./channellogs");
        this.once("connected", () => {
            this.newChannellogs(opts.channels);
            for (const c of opts.channels ?? []) this.cooldowns.set(c.replace("#", ""), 0);
        });
        this.cooldowns = new Map();
        /** @type {Record<string, import("fs").WriteStream>} */
        this.channellogs = {};
        scheduleJob("newchannellogs", "0 1 * * *", () => this.newChannellogs(opts.channels));
        loadCommands(this.commands, "commands/twitch/commands", this.helplist);
        loadCommands(this.commands, "commands/twitch/ccmds", this.helplist);
        loadCommands(this.commands, "commands/twitch/functions", this.helplist);
        loadEvents("events/twitch", this);
        loadEvents("events/twitch/interaction", this);
        /** @type {Record<string, string[]|undefined>} */
        this.messages = parseAutomessages();
        /** @type {Map<string, number>} */
        this.autoMessagePositions = new Map();
        this.connect().catch(() => {
            logger.error("Failed to connect to Twitch.");
        });
    }
    /**
     * generates channellogs
     * @param {string[]} channels Channels to create channel logs for
     */
    newChannellogs(channels = this.channels) {
        const date = new Date();
        const month = `${date.getMonth() + 1}`.padStart(2, "0");
        const day = `${date.getDate()}`.padStart(2, "0");
        const year = date.getFullYear();
        const dateString = [year, month, day].join("-");
        for (let channel of channels) {
            channel = channel.replace("#", "");
            if (!existsSync(`./channellogs/${channel}`)) mkdirSync(`./channellogs/${channel}`);
            this.channellogs[channel] = createWriteStream(`./channellogs/${channel}/${dateString}.chatlog.txt`, {
                flags: "a",
            });
        }
    }
    /**
     *
     * @param {string} channel without # prefix
     * @returns {string|void}
     */
    getNextAutomessageFor(channel) {
        const messages = this.messages[channel];
        const nextMessagePosition = this.autoMessagePositions.get(channel) ?? 0;
        const retVal = messages[nextMessagePosition];
        this.autoMessagePositions.set(channel, nextMessagePosition + 1 < messages.length ? nextMessagePosition + 1 : 0);
        return retVal;
    }
    /**
     * stops the Twitch Client
     */
    async stop() {
        clearInterval(this.watchtime);
        logger.info("stopped watchtime collector");
        if (this.config.automessagedelay !== 0) {
            clearInterval(this.automessage);
            logger.info("stopped automessaging");
        }
        await this.disconnect();
        logger.info("disconnected from twitch");
    }
}
/**
 *
 * @returns {Record<string, string[]>}
 */
function parseAutomessages() {
    return JSON.parse(readFileSync("./configs/automessages.json", "utf8"));
}

/**
 * @returns {string[]}
 */
function parsePermitList() {
    return readFileSync("./configs/mods.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/)
        .filter((usr) => usr !== "");
}

/**
 *
 * @returns {string[]}
 */
function parseTLDs() {
    return readFileSync("./configs/TLDs.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/)
        .filter((link) => link !== "");
}

/**
 *
 * @returns {string[]}
 */
function parsePermittedLinks() {
    return readFileSync("./configs/links.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/)
        .filter((link) => link !== "");
}
