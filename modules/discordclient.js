const { Client, Collection } = require("discord.js");
const { loadCommands, loadEvents } = require("./functions")

/**
 * @typedef {Object} config
 * @property {string} token
 * @property {string} prefix
 * @property {Object} channels
 * @property {string} channels.blacklist
 * @property {string} channels.commands
 * @property {string} channels.status
 * @property {string} channels.relay
 */

/**
 * Discord Client
 * @class
 * @extends Client
 * @param {config} config
 * @param {Collection} commands
 * @param {string[]} helplist
 * @param {Clients} clients
 * @param {started} boolean
 * @param {TextChannel} blchannel
 * @param {TextChannel} statuschannel channel for sending status logs
 * @emits discord:message
 * @emits discord:ready 
 */
exports.DiscordClient = class DiscordClient extends Client {
    config;
    commands = new Collection;
    helplist = [];
    clients;
    started = false;
    blchannel;
    commandchannel;
    relaychannel;
    /**
     * 
     * @param {config} config discord part of the config file
     */
    constructor(config) {
        super();
        this.config = config;
        loadCommands(this.commands, "commands/discord")
        loadEvents("events/discord", this)
        console.log("logging in")
        this.login(config.token);
    }
    /**
     * stops the discord Client
     */
    async stop() {
        this.blchannel.setTopic(":red_circle: Bot Offline")
        this.commandchannel.setTopic(":red_circle: Bot Offline")
        this.relaychannel.setTopic(":red_circle: Bot Offline")
        console.log("set status to offline")
        setTimeout(() => this.destroy(), 500)
        console.log("disconnected from discord")
    }
}
