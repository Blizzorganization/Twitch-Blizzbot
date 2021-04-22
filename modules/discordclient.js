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
    statuschannel;
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
        this.statuschannel.setTopic("Bot Offline")
        console.log("set status to offline")
        await this.statuschannel.send("Goodbye")
        console.log("sent goodbye message")
        this.destroy()
        console.log("disconnected from discord")
    }
}
