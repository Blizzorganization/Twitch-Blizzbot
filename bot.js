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
const rl = readline.createInterface({input: process.stdin, output: process.stdout, prompt: ""})
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
  fs.readdir("./discordEvents/", (err, files) => {
    if (err) return console.error("Error reading discord events directory:", err);
    files.forEach(file => {
      if (!file.endsWith(".js")) return;
      const event = require(`./discordEvents/${file}`);
      let eventname = file.split(".")[0];
      discordClient.on(eventname, event.bind(null, discordClient));
    });
  });
  fs.readdir("./discordCommands/", (err, files) => {
    if (err) return console.error(err)
    files.forEach(file => {
      if (!file.endsWith(".js")) return
      let props = require("./discordCommands/"+file)
      let command = "!"+file.split(".")[0]
      console.log(`Attempting to load Command ${command}`)
      discordClient.commands.set(command, props)
      if (props.help) discordClient.cmds.push(command)
      if (!props.alias) return
      props.alias.forEach((a) => {
        console.log(`Adding alias !${a} for ${command}`)
        discordClient.commands.set("!"+a, props)
      })
    })
  })
}
twitchClient.clients = clients
twitchClient.dicecooldown = false
//setup customcommand database
twitchClient.aliases = new enmap({name:"aliases"})
twitchClient.ccmds = new enmap({name:"customcommands"})
twitchClient.blacklist = new enmap({name:"blacklist"})
twitchClient.blacklist.ensure("delmsg", [])
twitchClient.commands = new enmap()
twitchClient.cmds = []
rl.commands = new enmap()
fs.readdir("./twitchCommands/commands/", (err, files) => {
  if (err) return console.error(err)
  files.forEach(file => {
    if (!file.endsWith(".js")) return
    let props = require("./twitchCommands/commands/"+file)
    let command = "!"+file.split(".")[0]
    console.log(`Attempting to load Command ${command}`)
    twitchClient.commands.set(command, props)
    if (props.help) twitchClient.cmds.push(command)
    if (!props.alias) return
    props.alias.forEach((a) => {
      console.log(`Adding alias !${a} for ${command}`)
      twitchClient.commands.set("!"+a, props)
    })
  })
})
fs.readdir("./twitchCommands/functions/", (err, files) => {
  if (err) return console.error(err)
  files.forEach(file => {
    if (!file.endsWith(".js")) return
    let props = require("./twitchCommands/functions/"+file)
    let command = "!"+file.split(".")[0]
    console.log(`Attempting to load Command ${command}`)
    twitchClient.commands.set(command, props)
    if (props.help) twitchClient.cmds.push(command)
    if (!props.alias) return
    props.alias.forEach((a) => {
      console.log(`Adding alias !${a} for ${command}`)
      twitchClient.commands.set("!"+a, props)
    })
  })
})
fs.readdir("./consoleCommands/", (err, files) => {
  if (err) return console.error(err)
  files.forEach(file => {
    if (!file.endsWith(".js")) return
    let props = require("./consoleCommands/"+file)
    let command = file.split(".")[0]
    console.log(`Attempting to load Command ${command}`)
    rl.commands.set(command, props)
    if (!props.alias) return
    props.alias.forEach((a) => {
      console.log(`Adding alias ${a} for ${command}`)
      rl.commands.set(a, props)
    })
  })
})
fs.readdir("./twitchEvents/", (err, files) => {
  if (err) return console.error("Error reading twitch events directory:", err);
  files.forEach(file => {
      if (!file.endsWith(".js")) return;
      const event = require(`./twitchEvents/${file}`);
      let eventname = file.split(".")[0];
      twitchClient.on(eventname, event.bind(null, twitchClient));
  });
});
fs.readdir("./consoleEvents/", (err, files) => {
  if (err) return console.error("Error reading console events directory:", err);
  files.forEach(file => {
      if (!file.endsWith(".js")) return;
      const event = require(`./consoleEvents/${file}`);
      let eventname = file.split(".")[0];
      rl.on(eventname, event.bind(null, clients));
  });
});
// Connect to Twitch:
twitchClient.connect();
