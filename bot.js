#!/usr/bin/node
const { appendFileSync, readFileSync, existsSync } = require("fs");
const { Clients } = require("./modules/clients");
const { ConsoleClient } = require("./modules/consoleclient");
const { DiscordClient } = require("./modules/discordclient");
const { TwitchClient } = require("./modules/twitchclient");
const { createConfig } = require("./setup");
(async () => {
    if (process.argv0.length >= 18) process.title = "Twitch-Blizzbot@" + require("./package.json").version;
    if (!existsSync("./config.json")) await createConfig();
    const config = JSON.parse(readFileSync("./config.json").toString());
    appendFileSync("links.txt", ""); //making sure a links.txt exists
    require("./modules/logger").debug("starting bot");
    var clients = new Clients(config);
    var discordClient;
    const twitchClient = new TwitchClient(config.twitch);
    clients.twitch = twitchClient;
    twitchClient.clients = clients;
    const consoleClient = new ConsoleClient();
    clients.console = consoleClient;
    consoleClient.clients = clients;
    if (config.useDiscord == true) {
        if (config.twitch.channels.indexOf(`#${config.discord.watchtimechannel}`) == -1) {
            clients.logger.error("Der Discord Watchtime Channel muss in den Twitch channeln enthalten sein.");
            process.exit(1);
        }
        discordClient = new DiscordClient(config.discord);
        clients.discord = discordClient;
        discordClient.clients = clients;
        let dcReady = new Promise((resolve) => discordClient.once("ready", () => resolve()));
        let twReady = new Promise((resolve) => twitchClient.once("connected", () => resolve()));
        Promise.all([dcReady, twReady]).then(() => {
            setTimeout(() => {
                clients.logger.log("debug", "changing channel topics");
                discordClient.channelTopic();
            }, 300000);
        });
        global.discordClient = discordClient;
    }
    global.clients = clients;
    global.twitchClient = twitchClient;
})();