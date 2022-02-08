/* eslint-disable no-empty-function */
const { EOL } = require("os");
/**
 * @typedef watchtimeuser
 * @property {string} viewer
 * @property {number} watchtime
*/
/**
 * @typedef resolvedAlias
 * @property {string} alias
 * @property {string} command
 * @property {string} response
 * @property {number} permissions
 */
/**
 * @typedef config
 * @property {boolean} keepAlive
 * @property {string} host
 * @property {string} database
 * @property {string} user
 * @property {string} password
 */
/** @typedef cmdData
 * @property {string} commandname
 * @property {string} response
 */
/** @typedef old_watchtime
 * @property {number} watchtime
 * @property {string} user
*/
/**
 * @class DB
 */
class ProtoDB {
    /**
     * @description Handles data storage for the bot
     * @param  {config} config
     */
    constructor() {
        this.clients = undefined;
    }
    /**
     * Method for manually querying data
     * @param {string} sql
     * @param {any[]} data
     */
    async query() {
    }
    /**
     * @description stops the database
     */
    stop() {
    }
    /**
     * @description add a new channel to the database
     * @param {string} channel
     *
     */
    async newChannel() {
    }
    /**
     * @description add a new channel to the database
     * @param {string} channel
     * @returns {{name: string, automessage: boolean}?}
     */
    async getChannel() {
    }
    // #region Aliases
    /**
     * @description adds an Alias to a custom command
     * @param {string} channel Channel where to add the Alias
     * @param {string} name name of the Alias
     * @param {string} command Command the alias refers to
     */
    async newAlias() {
    }
    /**
     * @description get the alias data
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<resolvedAlias?>} command data
     */
    async resolveAlias() {
    }
    /**
     * @description delete an alias
     * @param {string} name Name of the Alias to delete
     * @param {string} channel
     */
    async deleteAlias() {
    }
    /**
     * @description Get all existing aliases
     * @param {string} channel
     * @returns {Promise<string[]>} List of all Aliases
     */
    async getAliases() {
    }
    // #endregion aliasses
    // #region counters
    /**
     * @description creates a new counter
     * @param  {string} channel channel to create the counter for
     * @param  {string} name counter name
     * @param  {number} inc=1 the automatic increase
     * @param  {number} defaultVal=0 the starting value
     */
    async newCounter() {
    }
    /**
     * @description read a counter value. This does NOT modify the value
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<number?>} value if exists
     */
    async readCounter() {
    }
    /**
     * @description read the counter value, increase it by the predefined amount
     * @param  {string} channel
     * @param  {string} name
     * @returns {Promise<number?>}
     */
    async getCounter() {
    }
    /**
     * @description sets a counter value
     * @param  {string} channel
     * @param  {string} name
     * @param  {number} val
     */
    async setCounter() {
    }
    /**
     * @description Deletes a counter
     * @param  {string} channel
     * @param  {string} name
     */
    async delCounter() {
    }
    // #endregion counters
    // #region Customcommands
    /**
     * @description get all customcommands
     * @param {string} channel
     * @param {number?} permission
     * @returns {Promise<string[]?>} list of customcommands
     */
    async allCcmds() {
    }
    /**
     * @description get response of customcommand
     * @param {string} channel
     * @param {string} commandname
     * @returns {Promise<?string>} response
     */
    async getCcmd() {
    }
    /**
     * Create new Customcommand/change its response
     * @param {string} channel
     * @param {string} commandname
     * @param {string} response
     * @param {number} permissions
     */
    async newCcmd() {
    }
    /**
     * @description migrate the old customcommand datastructure
     * @param  {cmdData[]} cmdData
     * @param  {string} channel
     * @param  {"user"|"vip"|"sub"|"mod"|"streamer"|"dev"} cmdType
     */
    async migrateCustomcommands() {
    }
    /**
    * @description Edit a Customcommand/change its response
    * @param {string} channel
    * @param {string} commandname
    * @param {string} response
    */
    async editCcmd() {
    }
    /**
     * @description delete a Customcommand
     * @param {string} channel
     * @param {string} commandname
     */
    async delCcmd() {
    }
    /**
     * @description transfers a customcommande to user or mod permission level
     * @param  {string} channel
     * @param  {string} commandname
     * @returns {"no_such_command"|"ok"}
     */
    async transferCmd() {
    }
    // #endregion Customcommands
    // #region watchtime
    /**
     * @description Default Watchtime Increase (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {string[]} chatters List of Users to add Watchtime to
     */
    async watchtime() {
        const started = new Date;
        this.clients.logger.log("info", "starting watchtime at " + started.toLocaleTimeString());
        // do_stuff_here
        const endtime = new Date;
        this.clients.logger.log("info", "finished watchtime at " + endtime.toLocaleTimeString() + EOL + "Took " + (endtime.getTime() - started.getTime()) + "ms.");
    }
    /**
     * @description Watchtime migration method (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {old_watchtime[]} chatters List of Users to add Watchtime to
     * @param {string} month The month to add the watchtime at
     */
    async migrateWatchtime() {
    }
    /**
     * @description get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {string} month the month the watchtime was recorded at
     * @param {number} max Amount of Viewers to fetch
     * @param {number?} page default 1
     * @returns {Promise<watchtimeuser[]>} Sorted Watchtime List
     */
    async watchtimeList() {
    }
    /**
     * @description get Watchtime for User on Channel
     * @param {string} channel the channel the watchtime is being collected for
     * @param {string} user the viewer the watchtime is being collected for
     * @param {string} [month] the month the watchtime is recorded at
     * @returns {Promise<number?>} watchtime of the user
     */
    async getWatchtime() {
    }
    // #endregion watchtime

    /**
     * @description get linked twitch account if exists, otherwise returns null
     * @param {Discord.User} user discord user
     * @returns {Promise<string?>} twitch username
     */
    async getDiscordConnection() {
    }
    /**
     * @description Links a twitch user to a discord user
     * @param {Discord.User} user discord user
     * @param {string} twitchname twitch username
     */
    async newDiscordConnection() {
    }
    /**
     * @param  {Discord.User} user
     */
    async deleteDiscordConnection() {
    }
    // #region blacklist
    /**
     * @description saves the blacklist stored in `this.clients.twitch.blacklist` as {channel(string): blacklistwords(Array<string>)}
     */
    async saveBlacklist() {
    }
    /**
     * @description load the blacklist into `this.clients.twitch.blacklist`
     */
    async loadBlacklist() {
    }
    // #endregion
}
exports.DB = ProtoDB;