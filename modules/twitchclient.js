const { Collection } = require("discord.js");
const { createWriteStream, existsSync, mkdirSync, readFileSync } = require("fs");
const { Client } = require("tmi.js");
const { loadCommands, loadEvents } = require("./functions");
const schedule = require("node-schedule");

/**
 * @typedef configExtension
 * @property {number} Cooldown
 * @property {number} automessagedelay
 * @property {string[]} devs
 * @property {number} Raidminutes
 * @property {string} clientId
 *
 * @typedef {configExtension~import("tmi.js").Options} config
 */

exports.TwitchClient = class TwitchClient extends Client {
    /**
     * TwitchClient
     * @class TwitchClient
     * @extends {Client}
     * @param {config} opts
     * @property {import("fs").WriteStream[]} channellogs
     * @property {import("./clients").Clients} clients
     * @property {boolean} started
     * @property {Collection} commands
     * @property {Enmap} blacklist
     * @property {any} watchtime
     * @property {any} automessage
     * @property {string[]} channels
     */
    constructor(opts) {
        super(opts);
        this.config = opts;
        this.started = false;
        this.commands = new Collection;
        this.helplist = [];
        /** @type {string[]}*/
        this.channels = [];
        this.permittedlinks = readFileSync("./links.txt", "utf8").split(/\r\n|\n\r|\n|\r/).filter((link) => link !== "");
        this.watchtime = undefined;
        this.automessage = undefined;
        /** @type {import("./clients").Clients}*/
        this.clients = undefined;
        /** @type {import("../typings/blacklist").bltype}*/
        // @ts-ignore
        this.blacklist = [];
        if (!existsSync("./channellogs")) mkdirSync("./channellogs");
        this.once("connected", () => {
            this.newChannellogs(opts.channels);
            for (const c of opts.channels) this.cooldowns.set(c.replace("#", ""), 0);
        });
        this.cooldowns = new Map;
        this.channellogs = [];
        schedule.scheduleJob("newchannellogs", "0 1 * * *", () => this.newChannellogs(opts.channels));
        loadCommands(this.commands, "commands/twitch/commands", this.helplist);
        loadCommands(this.commands, "commands/twitch/ccmds", this.helplist);
        loadCommands(this.commands, "commands/twitch/functions", this.helplist);
        loadEvents("events/twitch", this);
        /* loadEvents("events/twitch/interaction", this);*/
        this.messages = require("../automessages.json");
        this.connect();
    }
    /**
     * generates channellogs
     * @param {string[]} channels Channels to create channel logs for
     */
    newChannellogs(channels = this.channels) {
        const date = new Date();
        let month = "" + (date.getMonth() + 1);
        let day = "" + date.getDate();
        const year = date.getFullYear();
        if (month.length < 2) {month = "0" + month;}
        if (day.length < 2) {day = "0" + day;}
        const dateString = [year, month, day].join("-");
        for (let channel of channels) {
            channel = channel.replace("#", "");
            if (!existsSync(`./channellogs/${channel}`)) mkdirSync(`./channellogs/${channel}`);
            this.channellogs[channel] = createWriteStream(`./channellogs/${channel}/${dateString}.chatlog.txt`, { flags: "a" });
        }
    }
    /**
     * stops the Twitch Client
     */
    async stop() {
        clearInterval(this.watchtime);
        this.clients.logger.log("info", "stopped watchtime collector");
        if (this.config.automessagedelay !== 0) {
            clearInterval(this.automessage);
            this.clients.logger.log("info", "stopped automessaging");
        }
        await this.disconnect();
        this.clients.logger.log("info", "disconnected from twitch");
    }
};