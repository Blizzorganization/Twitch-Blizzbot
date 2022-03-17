const DB = require("./db");
const Logger = require("./logger");

exports.Clients = class Clients {
    constructor(config) {
        this.loadSlash = require("./slashsetup");
        this.config = config;
        /** @type {import("./twitchclient").TwitchClient}*/
        this.twitch = undefined;
        /** @type {import("./consoleclient").ConsoleClient}*/
        this.console = undefined;
        /** @type {import("./discordclient").DiscordClient}*/
        this.discord = undefined;
        this.logger = Logger;
        this.db = new DB.DB(config.db);
        this.db.clients = this;
    }
    /**
     * stops all Clients supplied
     */
    async stop() {
        this.logger.info("stopping");
        const stopping = [];
        stopping.push(this.db.stop());
        stopping.push(this.twitch.stop());
        stopping.push(this.console.stop());
        if (this.discord) stopping.push(this.discord.stop());
        const stopped = await Promise.all(stopping);
        this.logger.info("Goodbye");
        process.exit(0);
        return stopped;
    }
};