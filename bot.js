#!/usr/bin/node
const { appendFileSync, readFileSync, existsSync } = require("fs");
const { Clients } = require("./modules/clients");
const { ConsoleClient } = require("./modules/consoleclient");
const { DiscordClient } = require("./modules/discordclient");
const { TwitchClient } = require("./modules/twitchclient");
const { createConfig } = require("./setup");
(async () => {
    if (process.argv0.length >= 18) process.title = `Twitch-Blizzbot@${JSON.parse(readFileSync("./package.json", "utf8")).version}`;
    if (!existsSync("./config.json")) await createConfig();
    const config = JSON.parse(readFileSync("./config.json").toString());
    // making sure a links.txt exists
    appendFileSync("links.txt", "");
    require("./modules/logger").debug("starting bot");
    const clients = new Clients(config);
    let discordClient;
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
        const dcReady = new Promise((resolve) => discordClient.once("ready", () => resolve()));
        const twReady = new Promise((resolve) => twitchClient.once("connected", () => resolve()));
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