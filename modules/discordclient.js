const { Client, Collection, Intents, TextChannel } = require("discord.js");
const { loadCommands, loadEvents } = require("./functions");
/**
 * @typedef {Object} config
 * @property {string} token
 * @property {string} prefix
 * @property {string} watchtimechannel
 * @property {string[]} evalusers
 * @property {Object} channels
 * @property {string} channels.blacklist
 * @property {string} channels.commands
 * @property {string} channels.relay
 * @property {string} channels.adminCommands
 */
exports.DiscordClient = class DiscordClient extends Client {
    config;
    commands = new Collection;
    slashcommands = new Collection;
    helplist = [];
    /** @type {import("./clients").Clients} */
    clients;
    started = false;
    blchannel;
    commandchannel;
    relaychannel;
    /**
     * Discord Client
     * @class DiscordClient
     * @extends Client
     * @property {config} config
     * @property {Collection} commands
     * @property {string[]} helplist
     * @property {import("./clients").Clients} clients
     * @property {boolean} started
     * @property {import("discord.js").TextChannel} blchannel
     * @property {import("discord.js").TextChannel} statuschannel channel for sending status logs
     */
    /**
     * https://github.com/Blizzor/Twitch-Blizzbot.wiki.git
     * @param {config} config discord part of the config file
     */
    constructor(config) {
        super({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_MEMBERS,
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
            ],
        });
        this.config = config;
        loadCommands(this.commands, "commands/discord/commands");
        loadCommands(this.commands, "commands/discord/functions");
        loadCommands(this.slashcommands, "commands/discord/slash");
        loadEvents("events/discord", this);
        require("./logger").log("info", "logging in");
        this.login(config.token);
    }
    /**
     * changes the channel topics of the blacklist, relay and status channels
     */
    async channelTopic() {
        const blchannel = await this.channels.fetch(this.config.channels.blacklist);
        if (blchannel instanceof TextChannel) {
            await blchannel.setTopic(":green_circle: Hier wir die Blacklist vom Bot angezeigt");
        } else {
            this.clients.logger.error("blchannel is not a Guild Text Channel.");
        }
        const relaychannel = await this.channels.fetch(this.config.channels.relay);
        if (relaychannel instanceof TextChannel) {
            await relaychannel.setTopic(":green_circle: Nachrichten werden über den Bot ausgegeben.");
        } else {
            this.clients.logger.error("Relay channel is not a Guild Text Channel.");
        }
        const adminchannel = await this.channels.fetch(this.config.channels.adminCommands);
        if (adminchannel instanceof TextChannel) {
            await adminchannel.setTopic(":green_circle: Commands für den Twitch-Bot.");
        } else {
            this.clients.logger.error("Admin channel is not a Guild Text Channel.");
        }
    }
    /**
     * stops the discord Client
     */
    async stop() {
        this.blchannel?.setTopic(":red_circle: Bot Offline");
        this.commandchannel?.setTopic(":red_circle: Bot Offline");
        this.relaychannel?.setTopic(":red_circle: Bot Offline");
        this.clients.logger.log("debug", "set status to offline");
        setTimeout(() => this.destroy(), 500);
        this.clients.logger.log("info", "disconnected from discord");
    }
};