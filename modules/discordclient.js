import { Client, Collection, GatewayIntentBits, TextChannel } from "discord.js";
import { loadCommands, loadEvents } from "./functions.js";
import { logger } from "./logger.js";
/**
 * @typedef {object} Config
 * @property {string} token
 * @property {string} prefix
 * @property {string} watchtimechannel
 * @property {string[]} evalUsers
 * @property {object} channels
 * @property {string} channels.blacklist
 * @property {string} channels.commands
 * @property {string} channels.relay
 * @property {string} channels.adminCommands
 */

/**
 * Discord Client
 * @class DiscordClient
 * @augments Client
 * @property {Config} config
 * @property {Collection} commands
 * @property {string[]} helplist
 * @property {import("./clients").Clients} clients
 * @property {boolean} started
 * @property {import("discord.js").TextChannel} blchannel
 * @property {import("discord.js").TextChannel} statuschannel channel for sending status logs
 */
export class DiscordClient extends Client {
    /**
     * https://github.com/Blizzor/Twitch-Blizzbot.wiki.git
     * @param {Config} config discord part of the config file
     */
    constructor(config) {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
            ],
        });
        this.commands = new Collection();
        this.slashcommands = new Collection();
        this.config = config;
        this.helplist = [];
        /** @type {import("discord.js").TextChannel} */
        this.blchannel = undefined;
        /** @type {import("discord.js").TextChannel} */
        this.relaychannel = undefined;
        /** @type {import("discord.js").TextChannel} */
        this.adminchannel = undefined;
        /** @type {import("discord.js").TextChannel} */
        this.commandchannel = undefined;
        this.started = false;
        /** @type {import("./clients.js").Clients} */
        this.clients = undefined;
        loadCommands(this.commands, "commands/discord/commands");
        loadCommands(this.commands, "commands/discord/functions");
        loadCommands(this.slashcommands, "commands/discord/slash");
        loadCommands(this.commands, "commands/discord/ccmds");
        loadEvents("events/discord", this);
        logger.info("logging in");
        this.login(config.token).catch(() => {
            logger.error("Failed to login.");
        });
    }
    /**
     * changes the channel topics of the blacklist, relay and status channels
     */
    async channelTopic() {
        const blchannel = await this.channels.fetch(this.config.channels.blacklist);
        if (blchannel instanceof TextChannel) {
            this.blchannel = blchannel;
            await this.blchannel.setTopic(":green_circle: Hier wir die Blacklist vom Bot angezeigt");
        } else {
            logger.error("blchannel is not a Guild Text Channel.");
        }
        const relaychannel = await this.channels.fetch(this.config.channels.relay);
        if (relaychannel instanceof TextChannel) {
            this.relaychannel = relaychannel;
            await this.relaychannel.setTopic(":green_circle: Nachrichten werden über den Bot ausgegeben.");
        } else {
            logger.error("Relay channel is not a Guild Text Channel.");
        }
        const adminchannel = await this.channels.fetch(this.config.channels.adminCommands);
        if (adminchannel instanceof TextChannel) {
            this.adminchannel = adminchannel;
            await this.adminchannel.setTopic(":green_circle: Commands für den Twitch-Bot.");
        } else {
            logger.error("Admin channel is not a Guild Text Channel.");
        }
        // eslint-disable-next-line no-unused-vars
        const commandchannel = await this.channels.fetch(this.config.channels.adminCommands);
        if (commandchannel instanceof TextChannel) {
            this.commandchannel = commandchannel;
            await this.commandchannel.setTopic(":green_circle: Commands für den Twitch-Bot.");
        } else {
            logger.error("Command channel is not a Guild Text Channel.");
        }
    }
    /**
     * stops the discord Client
     */
    async stop() {
        await Promise.allSettled([
            this.blchannel?.setTopic(":red_circle: Bot Offline"),
            this.commandchannel?.setTopic(":red_circle: Bot Offline"),
            this.relaychannel?.setTopic(":red_circle: Bot Offline"),
        ]);
        logger.log("debug", "set status to offline");
        setTimeout(() => this.destroy(), 500);
        logger.info("disconnected from discord");
    }
}
