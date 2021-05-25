const { appendFileSync, readFileSync } = require("fs");
const { Clients } = require("./modules/clients");
const { ConsoleClient } = require("./modules/consoleclient");
const { DiscordClient } = require("./modules/discordclient");
const { TwitchClient } = require("./modules/twitchclient");

const config = JSON.parse(readFileSync("./config.json").toString())
appendFileSync('links.txt', '') //making sure a links.txt exists
var clients = new Clients()
var discordClient;
const twitchClient = new TwitchClient(config.twitch)
clients.twitch = twitchClient
twitchClient.clients = clients
const consoleClient = new ConsoleClient()
clients.console = consoleClient
consoleClient.clients = clients
if (config.useDiscord == true) {
    discordClient = new DiscordClient(config.discord)
    clients.discord = discordClient
    discordClient.clients = clients
}