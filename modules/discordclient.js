const { Client, Collection } = require("discord.js");
const { existsSync, readdir } = require("fs");
const { CustomError } = require("./CustomError");

exports.DiscordClient = class DiscordClient extends Client {
    config;
    commands = new Collection;
    helplist = [];
    clients;
    started = false;
    blchannel;
    statuschannel;
    constructor(config) {
        super();
        this.config = config;
        this.loadCommands(this.commands, "commands/discord")
        this.loadEvents("events/discord")
        console.log("logging in")
        this.login(config.token);
    }
    loadCommands(commandmap, commanddir, helplist) {
        var readcommanddir = "./" + commanddir
        if (existsSync(readcommanddir)) {
            readdir(`./${readcommanddir}/`, (err, files) => {
                if (err) return console.error(err);
                files.forEach(file => {
                    if (!(file.endsWith(".js") || file.endsWith(".ts"))) return;
                    let props = require(`../${commanddir}/${file.split(".")[0]}`);
                    let command = this.config.prefix + file.split(".")[0]
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
        await this.statuschannel.send("Goodbye")
        await this.statuschannel.setTopic("Bot Offline")
        this.destroy()
    }
}
