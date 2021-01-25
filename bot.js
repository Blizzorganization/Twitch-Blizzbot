const discord = require("discord.js")
const enmap = require("enmap");
const fetch = require("node-fetch")
const fs = require("fs")
const readline = require("readline")
const tmi = require('tmi.js')
// Define configuration options
const config = require("./config.json")
const rl = readline.createInterface({input: process.stdin, output: process.stdout, prompt: "Say on Twitch: "})
// Create a client with our options
const client = new tmi.client(config.opts);
client.discord = new discord.Client()
client.discord.login(config.discord.token)
client.started = false
client.discord.started = false
client.discord.on("ready", () => {
  client.discord.channel = client.discord.channels.resolve(config.discord.blchannel)
  if (!client.discord.channel) return console.log("Fehler: Discord Blacklist Channel wurde nicht gefunden.")
  if (client.started&&!client.discord.started) client.discord.channel.send("Bot wurde gestartet.")
  client.discord.started = true
})
client.dicecooldown = false
// Setup custom command database
client.aliases = new enmap({name:"aliases"})
client.ccmds = new enmap({name:"customcommands"})
client.blacklist = new enmap({name:"blacklist"})
client.blacklist.ensure("delmsg", [])
client.commands = new enmap()
client.cmds = []
fs.readdir("./commands/", (err, files) => {
  if (err) return console.error(err)
  files.forEach(file => {
    if (!file.endsWith(".js")) return
    let props = require("./commands/"+file)
    let command = "!"+file.split(".")[0]
    console.log(`Attempting to load Command ${command}`)
    client.commands.set(command, props)
    if (props.help) client.cmds.push(command)
    if (!props.alias) return
    props.alias.forEach((a) => {
      console.log(`Adding alias !${a} for ${command}`)
      client.commands.set("!"+a, props)
    })
  })
})
fs.readdir("./functions/", (err, files) => {
  if (err) return console.error(err)
  files.forEach(file => {
    if (!file.endsWith(".js")) return
    let props = require("./functions/"+file)
    let command = "!"+file.split(".")[0]
    console.log(`Attempting to load Command ${command}`)
    client.commands.set(command, props)
    if (props.help) client.cmds.push(command)
    if (!props.alias) return
    props.alias.forEach((a) => {
      console.log(`Adding alias !${a} for ${command}`)
      client.commands.set("!"+a, props)
    })
  })
})
// Register our event handlers (defined below)
client.on('connected', (addr, port) => {
  console.log(`* Connected to ${addr}:${port}`);
  if (client.discord.started) client.discord.channel.send("Bot wurde gestartet.")
  client.started = true
});
client.once("connected", () => {
    rl.on("line", (line) => {
        if (line.startsWith("|")) return eval(line.slice(1))
        if (line == "stop") return process.exit(0)
        client.say("#blizzor96", line)
    })
})
// Connect to Twitch:
client.connect();
function checkModAction(client, msg, ctx) {
  if (ctx.mod) return
  let message = msg.toLowerCase()
  let delbl = client.blacklist.get("delmsg")
  checkmsg = ` ${message} `
  if (delbl.some((a) => checkmsg.includes(` ${a}`))) client.deletemessage("#blizzor96", ctx.id)
}

client.on("message", async (target, context, msg, self) => {
  if (self) return; // Ignore messages from the bot

  // Remove whitespace from chat message
  let args = msg.trim().split(" ");
  checkModAction(client, msg, context)
  const commandName = args.shift().toLowerCase();
  let cmd = client.commands.get(commandName)
  if (cmd) {
    cmd.run(client, target, context, msg, self, args)
    console.log(`* Executed ${commandName} command`);
  } else {
    cmd = client.ccmds.get(commandName);
    if (!cmd) cmd = client.ccmds.get(client.aliases.get(commandName))
    if (cmd) {
      client.say(target, cmd);
      console.log(`* Executed ${commandName} Customcommand`)
    }
  }
})
