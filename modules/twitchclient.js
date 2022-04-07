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
 * @typedef {configExtension & import("tmi.js").Options} config
 */

/**
 * @typedef {{[key: `${number}`]: string[]}} blacklist
 */

/**
 * TwitchClient
 *
 * @class TwitchClient
 * @augments {Client}
 * @property {import("fs").WriteStream[]} channellogs
 * @property {import("./clients").Clients} clients
 * @property {boolean} started
 * @property {Collection} commands
 * @property {blacklist} blacklist
 * @property {any} watchtime
 * @property {any} automessage
 * @property {string[]} channels
 */
export class TwitchClient extends Client {
    /**
     * @param  {config} opts
     */
    constructor(opts) {
        super(opts);
        this.config = opts;
        this.started = false;
        this.commands = new Collection();
        this.helplist = [];
        /** @type {string[]}*/
        this.channels = [];
        this.permittedlinks = readFileSync("./configs/links.txt", "utf8")
            .split(/\r\n|\n\r|\n|\r/)
            .filter((link) => link !== "");
        this.deletelinks = readFileSync("./configs/TLDs.txt", "utf8")
            .split(/\r\n|\n\r|\n|\r/)
            .filter((link) => link !== "");
        this.watchtime = undefined;
        this.automessage = undefined;
        /** @type {import("./clients").Clients}*/
        this.clients = undefined;
        /** @type {{[key: string]: blacklist}}*/
        // @ts-ignore
        this.blacklist = [];
        if (!existsSync("./channellogs")) mkdirSync("./channellogs");
        this.once("connected", () => {
            this.newChannellogs(opts.channels);
            for (const c of opts.channels) this.cooldowns.set(c.replace("#", ""), 0);
        });
        this.cooldowns = new Map();
        this.channellogs = [];
        scheduleJob("newchannellogs", "0 1 * * *", () => this.newChannellogs(opts.channels));
        loadCommands(this.commands, "commands/twitch/commands", this.helplist);
        loadCommands(this.commands, "commands/twitch/ccmds", this.helplist);
        loadCommands(this.commands, "commands/twitch/functions", this.helplist);
        loadEvents("events/twitch", this);
        loadEvents("events/twitch/interaction", this);
        this.messages = JSON.parse(readFileSync("./configs/automessages.json", "utf8"));
        this.connect();
    }
    /**
     * generates channellogs
     *
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
