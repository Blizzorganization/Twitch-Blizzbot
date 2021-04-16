const { Collection } = require("discord.js");
const enmap = require("enmap");
const { createWriteStream, existsSync, mkdirSync, readdir } = require("fs");
const { client } = require("tmi.js");
const { CustomError } = require("./CustomError");
const { DB } = require("./db");
const schedule = require("node-schedule")

exports.TwitchClient = class TwitchClient extends client {
    channellogs = [];
    logChannels;
    config;
    clients;
    started = false;
    commands = new Collection()
    blacklist = new enmap({ name: "blacklist" })
    db;
    watchtime;
    constructor(opts) {
        super(opts);
        this.config = opts;
        if (!existsSync("./channellogs")) mkdirSync("./channellogs")
        this.newChannellogs()
        schedule.scheduleJob("newchannellogs", "0 17 * * *", this.newChannellogs)
        this.blacklist.ensure("delmsg", [])
        this.db = new DB()
        this.loadCommands(this.commands, "commands/twitch/commands")
        this.loadCommands(this.commands, "commands/twitch/functions")
        this.loadEvents("events/twitch")
        this.loadEvents("events/twitch/interaction")
        this.connect()
    }
    newChannellogs() {
        var date = new Date()
        var month = '' + (date.getMonth() + 1);
        var day = '' + date.getDate();
        var year = date.getFullYear();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        var dateString = [year, month, day].join('-');
        for (let channel of this.getChannels()) {
            channel = channel.replace("#", "")
            if (!existsSync(`./channellogs/${channel}/`)) mkdirSync(`./channellogs/${channel}`)
            this.channellogs[channel] = createWriteStream(`./channellogs/${channel}/${dateString}.chatlog.txt`).destroy
        }
    }
    loadCommands(commandmap, commanddir, helplist) {
        var readcommanddir = "./" + commanddir
        if (existsSync(readcommanddir)) {
            readdir(`./${readcommanddir}/`, (err, files) => {
                if (err) return console.error(err);
                files.forEach(file => {
                    if (!(file.endsWith(".js") || file.endsWith(".ts"))) return;
                    let props = require(`../${commanddir}/${file.split(".")[0]}`);
                    let command = "!" + file.split(".")[0]
                    console.log(`Attempting to load Command ${command}`)
                    commandmap.set(command, props)
                    if (props.help && helplist) helplist.push(command)
                    if (!props.alias) return
                    props.alias.forEach((a) => {
                        console.log(`Adding alias !${a} for ${command}`)
                        commandmap.set("!" + a, props)
                    })
                })
            })
        } else throw new CustomError("LoadError", `CommandDirectory ${commanddir} does not exist.`)
    }
    loadEvents(eventdir) {
        var readeventdir = "./" + eventdir
        if (existsSync(readeventdir)) {
            readdir(`./${readeventdir}/`, (err, files) => {
                if (err) return console.error("Error reading discord events directory:", err);
                files.forEach(file => {
                    if (!(file.endsWith(".js") || file.endsWith(".ts"))) return;
                    let eventname = file.split(".")[0];
                    const { event } = require(`../${eventdir}/${eventname}`);
                    this.on(eventname, event.bind(null, this));
                });
            });
        } else throw new CustomError("LoadError", `EventDirectory ${eventdir} does not exist.`)
    }
    async stop() {
        this.db.stop()
        clearInterval(this.watchtime)
        this.disconnect()
    }
}