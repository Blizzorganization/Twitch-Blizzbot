import { logger } from "twitch-blizzbot/logger";
import { DB } from "./db.js";
import slashsetup from "./slashsetup.js";

export class Clients {
    constructor(config) {
        this.loadSlash = slashsetup;
        this.config = config;
        /** @type {import("./twitchclient").TwitchClient}*/
        this.twitch = undefined;
        /** @type {import("./consoleclient").ConsoleClient}*/
        this.console = undefined;
        /** @type {import("./discordclient").DiscordClient}*/
        this.discord = undefined;
        this.db = new DB(config.db);
        this.db.clients = this;
    }
    /**
     * stops all Clients supplied
     */
    async stop() {
        logger.info("stopping");
        const stopping = [];
        stopping.push(this.db.stop());
        stopping.push(this.twitch.stop());
        stopping.push(this.console.stop());
        if (this.discord) stopping.push(this.discord.stop());
        await Promise.all(stopping);
        logger.info("Goodbye");
        process.exit(0);
    }
}