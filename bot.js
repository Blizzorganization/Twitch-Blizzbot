#!/usr/bin/node
import { appendFileSync, readFileSync } from "fs";
import { Clients } from "twitch-blizzbot/clients";
import { ConsoleClient } from "twitch-blizzbot/consoleclient";
import { DiscordClient } from "twitch-blizzbot/discordclient";
import { logger } from "twitch-blizzbot/logger";
import { TwitchClient } from "twitch-blizzbot/twitchclient";
import { parseConfig } from "./modules/config.js";

(async () => {
    if (process.argv0.length >= 18) {
        process.title = `Twitch-Blizzbot@${JSON.parse(readFileSync("./package.json", "utf8")).version}`;
    }
    const config = parseConfig();

    // making sure a links.txt, TLDs.txt and mods.txt exists
    ["links", "TLDs", "mods"].forEach((txtFile) => appendFileSync(`configs/${txtFile}.txt`, ""));

    // starting bot
    logger.debug("starting bot");
    // @ts-expect-error -- to be fixed when using typescript
    const clients = new Clients(config);
    let discordClient;
    // @ts-expect-error -- to be fixed when using typescript
    const twitchClient = new TwitchClient(config.twitch);
    clients.twitch = twitchClient;
    twitchClient.clients = clients;
    const consoleClient = new ConsoleClient();
    clients.console = consoleClient;
    consoleClient.clients = clients;
    if (config.useDiscord === true) {
        if (config.twitch.channels.indexOf(`#${config.discord.watchtimechannel}`) === -1) {
            logger.error("Der Discord Watchtime Channel muss in den Twitch channeln enthalten sein.");
            process.exit(1);
        }
        // @ts-expect-error -- to be fixed when using typescript
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
