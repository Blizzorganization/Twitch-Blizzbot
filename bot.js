const { readFileSync } = require("fs");
const { Clients } = require("./clients");
const { ConsoleClient } = require("./consoleclient");
const { DiscordClient } = require("./discordclient");
const { TwitchClient } = require("./twitchclient");

const config = JSON.parse(readFileSync("./config.json").toString())
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