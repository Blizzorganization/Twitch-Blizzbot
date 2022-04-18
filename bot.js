#!/usr/bin/node
import { appendFileSync, existsSync, readFileSync } from "fs";
import { Clients } from "twitch-blizzbot/clients";
import { ConsoleClient } from "twitch-blizzbot/consoleclient";
import { DiscordClient } from "twitch-blizzbot/discordclient";
import { logger } from "twitch-blizzbot/logger";
import { TwitchClient } from "twitch-blizzbot/twitchclient";
import { createConfig } from "./setup.js";
(async () => {
    if (process.argv0.length >= 18) {
        process.title = `Twitch-Blizzbot@${JSON.parse(readFileSync("./package.json", "utf8")).version}`;
    }
    if (!existsSync("./configs/config.json")) await createConfig();
    const config = JSON.parse(readFileSync("./configs/config.json").toString());

    // making sure a links.txt and TLDs.txt exists
    ["links", "TLDs"].forEach((txtFile) => appendFileSync(`configs/${txtFile}.txt`, ""));

    // starting bot
    logger.debug("starting bot");
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
            logger.error("Der Discord Watchtime Channel muss in den Twitch channeln enthalten sein.");
            process.exit(1);
        }
        discordClient = new DiscordClient(config.discord);
        clients.discord = discordClient;
        discordClient.clients = clients;
        const dcReady = new Promise((resolve) => discordClient.once("ready", () => resolve()));
        const twReady = new Promise((resolve) => twitchClient.once("connected", () => resolve()));
        Promise.all([dcReady, twReady]).then(() => {
            setTimeout(() => {
                logger.info("changing channel topics");
                discordClient.channelTopic();
            }, 300000);
        });
        global.discordClient = discordClient;
    }
    global.clients = clients;
    global.twitchClient = twitchClient;
})();
