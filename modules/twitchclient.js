const { Collection } = require("discord.js");
const enmap = require("enmap");
const { createWriteStream, existsSync, mkdirSync, readdir } = require("fs");
const { client } = require("tmi.js");
const { loadCommands, loadEvents } = require("./functions")
const { DB } = require("./db");
const schedule = require("node-schedule")
/**
 * TwitchClient
 * @class
 * @extends client
 * @param {WriteStream[]} channellogs
 * @param {Object} config
 * @param {Clients} clients
 * @param {boolean} started
 * @param {Collection} commands
 * @param {enmap} blacklist
 * @param {DB} db
 * @param {Interval} watchtime
 * @emits twitch:message
 * @emits twitch:connected
 * @emits twitch:cheer
 * @emits twitch:giftpaidupgrade
 * @emits twitch:raided
 * @emits twitch:resub
 * @emits twitch:subgift
 * @emits twitch:subscription
 */
exports.TwitchClient = class TwitchClient extends client {
    channellogs = [];
    config;
    clients;
    started = false;
    commands = new Collection()
    blacklist = new enmap({ name: "blacklist" })
    db;
    watchtime;
    /**
     * 
     * @constructor
     * @param {Object} opts
     * @param {string[]} opts.channels
     */
    constructor(opts) {
        super(opts);
        this.config = opts;
        if (!existsSync("./channellogs")) mkdirSync("./channellogs")
        this.once("connected", () => this.newChannellogs(opts.channels))
        schedule.scheduleJob("newchannellogs", "0 17 * * *", this.newChannellogs)
        this.blacklist.ensure("delmsg", [])
        this.db = new DB()
        loadCommands(this.commands, "commands/twitch/commands")
        loadCommands(this.commands, "commands/twitch/functions")
        loadEvents("events/twitch", this)
        loadEvents("events/twitch/interaction", this)
        this.connect()
    }
    /**
     * generates channellogs
     * @param {string[]} channels Channels to create channel logs for
     */
    newChannellogs(channels = this.channels) {
        var date = new Date()
        var month = '' + (date.getMonth() + 1);
        var day = '' + date.getDate();
        var year = date.getFullYear();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        var dateString = [year, month, day].join('-');
        for (let channel of channels) {
            channel = channel.replace("#", "")
            if (!existsSync(`./channellogs/${channel}`)) mkdirSync(`./channellogs/${channel}`)
            this.channellogs[channel] = createWriteStream(`./channellogs/${channel}/${dateString}.chatlog.txt`, { flags: "a" })
        }
    }
    /**
     * stops the Twitch Client
     */
    async stop() {
        clearInterval(this.watchtime)
        console.log("stopped watchtime collector")
        await this.db.stop()
        console.log("db stopped")
        await this.disconnect()
        console.log("disconnected from twitch")
        await this.blacklist.close()
        console.log("stopped blacklist")
    }
}