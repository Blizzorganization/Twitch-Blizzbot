//import dependencies
const discord = require("discord.js")
const enmap = require("enmap");
const fetch = require("node-fetch")
const fs = require("fs")
const readline = require("readline")
const tmi = require('tmi.js')
//read config file
const config = require("./config.json")
//add console listener
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "" })
//create twitch client
const opts = config.twitch
let twitchClient = new tmi.client(opts);
twitchClient.config = opts
let discordClient
let clients = {}
clients.twitch = twitchClient
clients.console = rl
//check for discord config and optionally start discord Client
if (config.discord) {
    discordClient = new discord.Client()
    discordClient.login(config.discord.token)
    discordClient.config = config.discord
    discordClient.commands = new enmap()
    twitchClient.started = false
    discordClient.started = false
    clients.discord = discordClient
    discordClient.clients = clients
    fs.readdir("./events/discord/", (err, files) => {
        if (err) return console.error("Error reading discord events directory:", err);
        files.forEach(file => {
            if (!file.endsWith(".js")) return;
            const event = require(`./events/discord/${file}`);
            let eventname = file.split(".")[0];
            discordClient.on(eventname, event.bind(null, discordClient));
        });
    });
    fs.readdir("./commands/discord/", (err, files) => {
        if (err) return console.error(err)
        files.forEach(file => {
            if (!file.endsWith(".js")) return
            let props = require("./commands/discord/" + file)
            let command = "!" + file.split(".")[0]
            console.log(`Attempting to load Command ${command}`)
            discordClient.commands.set(command, props)
            if (props.help) discordClient.cmds.push(command)
            if (!props.alias) return
            props.alias.forEach((a) => {
                console.log(`Adding alias !${a} for ${command}`)
                discordClient.commands.set("!" + a, props)
            })
        })
    })
}
twitchClient.channellogs = []
if (!fs.existsSync("./channellogs")) fs.mkdirSync("./channellogs")
let dateString = new Date().toLocaleTimeString().replace(/T/, ' ').replace(/\..+/, '').replace(" ", "_")
config.twitch.channels.forEach(channel => {
    channel = channel.replace("#","")
    if (!fs.existsSync(`./channellogs/${channel}/`)) fs.mkdirSync(`./channellogs/${channel}`)
    twitchClient.channellogs[channel] = fs.createWriteStream(`./channellogs/${channel}/${dateString}.chatlog.txt`)
})
twitchClient.clients = clients
twitchClient.dicecooldown = false
//setup customcommand database
twitchClient.aliases = new enmap({ name: "aliases" })
twitchClient.ccmds = new enmap({ name: "customcommands" })
twitchClient.blacklist = new enmap({ name: "blacklist" })
twitchClient.blacklist.ensure("delmsg", [])
twitchClient.commands = new enmap()
twitchClient.cmds = []
rl.commands = new enmap()
//twitch
fs.readdir("./commands/twitch/commands/", (err, files) => {
    if (err) return console.error(err)
    files.forEach(file => {
        if (!file.endsWith(".js")) return
        let props = require("./commands/twitch/commands/" + file)
        let command = "!" + file.split(".")[0]
        console.log(`Attempting to load Command ${command}`)
        twitchClient.commands.set(command, props)
        if (props.help) twitchClient.cmds.push(command)
        if (!props.alias) return
        props.alias.forEach((a) => {
            console.log(`Adding alias !${a} for ${command}`)
            twitchClient.commands.set("!" + a, props)
        })
    })
})
fs.readdir("./commands/twitch/functions/", (err, files) => {
    if (err) return console.error(err)
    files.forEach(file => {
        if (!file.endsWith(".js")) return
        let props = require("./commands/twitch/functions/" + file)
        let command = "!" + file.split(".")[0]
        console.log(`Attempting to load Command ${command}`)
        twitchClient.commands.set(command, props)
        if (props.help) twitchClient.cmds.push(command)
        if (!props.alias) return
        props.alias.forEach((a) => {
            console.log(`Adding alias !${a} for ${command}`)
            twitchClient.commands.set("!" + a, props)
        })
    })
})
fs.readdir("./events/twitch/", (err, files) => {
    if (err) return console.error("Error reading twitch events directory:", err);
    files.forEach(file => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/twitch/${file}`);
        let eventname = file.split(".")[0];
        twitchClient.on(eventname, event.bind(null, twitchClient));
    });
});
//console
fs.readdir("./commands/console/", (err, files) => {
    if (err) return console.error(err)
    files.forEach(file => {
        if (!file.endsWith(".js")) return
        let props = require("./commands/console/" + file)
        let command = file.split(".")[0]
        console.log(`Attempting to load Command ${command}`)
        rl.commands.set(command, props)
        if (!props.alias) return
        props.alias.forEach((a) => {
            console.log(`Adding alias ${a} for ${command}`)
            rl.commands.set(a, props)
        })
    })
});
fs.readdir("./events/console/", (err, files) => {
    if (err) return console.error("Error reading console events directory:", err);
    files.forEach(file => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/console/${file}`);
        let eventname = file.split(".")[0];
        rl.on(eventname, event.bind(null, clients));
    });
});
// Connect to Twitch:
twitchClient.connect();
