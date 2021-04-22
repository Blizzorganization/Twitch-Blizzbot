const Database = require("better-sqlite3");
const { existsSync, mkdirSync } = require("fs");
const schedule = require("node-schedule")

/**
 * @typedef {Object} watchtimeuser
 * @property {string} user
 * @property {number} watchtime
 */

/**
 * Database Class
 * @class
 * @property {Database} customcommands
 * @property {Database} watchtimedb
 * @property {Database} monthlyWatchtime
 * @property {Map} statements
 * @property {string[]} watchtimechannels
 */
exports.DB = class DB {
    customcommands;
    watchtimedb;
    monthlyWatchtime;
    statements = new Map();
    watchtimechannels = [];
    constructor() {
        if (!(existsSync("./data"))) mkdirSync("./data");
        if (!(existsSync("./data/watchtime"))) mkdirSync("./data/watchtime");
        this.customcommands = new Database("data/customcommands.sqlite");
        this.watchtimedb = new Database("data/watchtime.sqlite")
        var date = new Date()
        var month = '' + (date.getMonth() + 1);
        var year = date.getFullYear();
        if (month.length < 2) month = '0' + month;
        this.monthlyWatchtime = new Database(`data/watchtime/${year}.${month}.sqlite`)
        this.customcommands.prepare("CREATE TABLE IF NOT EXISTS aliases (name text PRIMARY KEY, command text);").run()
        this.customcommands.prepare("CREATE TABLE IF NOT EXISTS ccmds (commandname text PRIMARY KEY, response text);").run()
        this.customcommands.prepare("CREATE TABLE IF NOT EXISTS coms (commandname text PRIMARY KEY, response text);").run()
        this.statements.set("newAlias", this.customcommands.prepare("INSERT OR IGNORE INTO aliases VALUES (@name, @command)"))
        this.statements.set("getAlias", this.customcommands.prepare("SELECT command FROM aliases WHERE name = @name;"))
        this.statements.set("getAliases", this.customcommands.prepare("SELECT name FROM aliases"))
        this.statements.set("delAlias", this.customcommands.prepare("DELETE FROM aliases WHERE name = @name"))
        this.statements.set("delAliases", this.customcommands.prepare("DELETE FROM aliases WHERE command = @command"))
        this.statements.set("getCcmd", this.customcommands.prepare("SELECT response FROM ccmds WHERE commandname = @commandname"))
        this.statements.set("getCom", this.customcommands.prepare("SELECT response FROM coms WHERE commandname = @commandname"))
        this.statements.set("allCcmds", this.customcommands.prepare("SELECT commandname FROM ccmds"))
        this.statements.set("allComs", this.customcommands.prepare("SELECT commandname FROM coms"))
        this.statements.set("newCcmd", this.customcommands.prepare("INSERT INTO ccmds VALUES (@commandname, @response)"))
        this.statements.set("newCom", this.customcommands.prepare("INSERT INTO coms VALUES (@commandname, @response)"))
        this.statements.set("delCcmd", this.customcommands.prepare("DELETE FROM ccmds WHERE commandname = @commandname"))
        this.statements.set("delCom", this.customcommands.prepare("DELETE FROM coms WHERE commandname = @commandname"))
        schedule.scheduleJob("newMonthlyWatchtime", "0 0 1 * *", async () => {
            await this.monthlyWatchtime.close()
            this.monthlyWatchtime = new Database(`data/watchtime/${year}.${month}.sqlite`)
            for (const channel of this.watchtimechannels) {
                this.mWatchtimeSetup(channel)
            }
        })
    }
    /**
     * setup monthly watchtime Table and prepare statements
     * @param {string} channel Twitch Channel Name
     */
    mWatchtimeSetup(channel) {
        this.monthlyWatchtime.prepare(`CREATE TABLE IF NOT EXISTS ${channel} (user text PRIMARY KEY, watchtime number);`).run()
        this.statements.set(`getMWachtimeFor${channel}`, this.monthlyWatchtime.prepare(`SELECT watchtime FROM ${channel} WHERE user = @user`))
        this.statements.set(`mwatchtimeNewFor${channel}`, this.monthlyWatchtime.prepare(`INSERT OR IGNORE INTO ${channel} VALUES (@user, 0);`))
        this.statements.set(`mwatchtimeIncFor${channel}`, this.monthlyWatchtime.prepare(`UPDATE ${channel} SET watchtime = watchtime + 1 WHERE user = @user`))
        this.statements.set(`mwatchtimeListFor${channel}`, this.monthlyWatchtime.prepare("SELECT user, watchtime FROM <channel> ORDER BY watchtime DESC LIMIT @max".replace("<channel>", channel)))
    }
    /**
     * adds an Alias to a custom command
     * @param {string} name name of the Alias
     * @param {string} command Command the alias refers to
     */
    newAlias(name, command) { this.statements.get("newAlias").run({ name, command }) }
    /**
     * resolve an alias
     * @param {string} name 
     * @returns {string|undefined} the command the alias refers to if the alias exists
     */
    getAlias(name) {
        let data = this.statements.get("getAlias").get({ name })
        return data ? data.command : undefined
    }
    /**
     * delete an alias
     * @param {string} name Name of the Alias to delete
     */
    deleteAlias(name) { this.statements.get("deleteAlias").run({ name }) }
    /**
     * Get all existing aliases
     * @returns {string[]} List of all Aliases
     */
    getAliases() { return this.statements.get("getAliases").all().map((row) => row.name) }
    /**
     * Generate Watchtime Table and prepare statements
     * @param {string} channel Twitch Channel Name
     */
    newWatchtimeChannel(channel) {
        if (channel.includes("#")) channel = channel.replace("#", "")
        this.watchtimedb.prepare(`CREATE TABLE IF NOT EXISTS ${channel} (user text PRIMARY KEY, watchtime number);`).run()
        this.statements.set(`getWachtimeFor${channel}`, this.watchtimedb.prepare(`SELECT watchtime FROM ${channel} WHERE user = @user`))
        this.statements.set(`watchtimeNewFor${channel}`, this.watchtimedb.prepare(`INSERT OR IGNORE INTO ${channel} VALUES (@user, 0);`))
        this.statements.set(`watchtimeIncFor${channel}`, this.watchtimedb.prepare(`UPDATE ${channel} SET watchtime = watchtime + 1 WHERE user = @user`))
        this.statements.set(`watchtimeListFor${channel}`, this.watchtimedb.prepare("SELECT user, watchtime FROM <channel> ORDER BY watchtime DESC LIMIT @max".replace("<channel>", channel)))
        this.mWatchtimeSetup(channel)
        this.watchtimechannels.push(channel);
    }
    /**
     * get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {number} max Amount of Viewers to fetch
     * @returns {watchtimeuser[]} Sorted Watchtime List
     */
    watchtimeList(channel, max) {
        if (!("number" == typeof max)) throw new TypeError("You have to select how many entries you need as a number.")
        return this.statements.get(`watchtimeListFor${channel}`).all({ max })
    }
    /**
     * get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {number} max Amount of Viewers to fetch
     * @returns {watchtimeuser[]} Sorted Watchtime List
     */
    mwatchtimeList(channel, max) {
        if (!("number" == typeof max)) throw new TypeError("You have to select how many entries you need as a number.")
        return this.statements.get(`mwatchtimeListFor${channel}`).all({ max })
    }
    /**
     * Default Watchtime Increase (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {string[]} chatters List of Users to add Watchtime to
     */
    watchtime(channel, chatters) {
        if (channel.includes("#")) channel = channel.replace("#", "")
        var watchtimenewstatement = this.statements.get(`watchtimeNewFor${channel}`)
        var watchtimeincstatement = this.statements.get(`watchtimeIncFor${channel}`)
        var mwatchtimenewstatement = this.statements.get(`mwatchtimeNewFor${channel}`)
        var mwatchtimeincstatement = this.statements.get(`mwatchtimeIncFor${channel}`)
        var transaction = this.watchtimedb.transaction((users) => {
            for (const user of users) {
                watchtimenewstatement.run({ channel, user })
                watchtimeincstatement.run({ channel, user })
                mwatchtimenewstatement.run({ channel, user })
                mwatchtimeincstatement.run({ channel, user })
            }
        })
        transaction(chatters)
    }
    /**
     * get Watchtime for User on Channel
     * @param {string} channel 
     * @param {string} user 
     * @returns {number|undefined} watchtime of the user
     */
    getWatchtime(channel, user) {
        if (channel.includes("#")) channel = channel.replace("#", "")
        let data = this.statements.get(`getWatchtimeFor${channel}`).get({ user })
        return data ? data.watchtime : undefined
    }
    /**
     * get monthly Watchtime for User on Channel
     * @param {string} channel 
     * @param {string} user 
     * @returns {number|undefined} watchtime of the user
     */
    getMWatchtime(channel, user) {
        if (channel.includes("#")) channel = channel.replace("#", "")
        let data = this.statements.get(`getMWatchtimeFor${channel}`).get({ user })
        return data ? data.watchtime : undefined;
    }
    /**
     * get all customcommands
     * @returns {string[]} list of customcommands
     */
    allCcmds() { return this.statements.get("allCcmds").all().map((row) => row.commandname) }
    /**
     * get all mod customcommands
     * @returns {string[]} list of mod customcommands
     */
    allComs() { return this.statements.get("allComs").all().map((row) => row.commandname) }
    /**
     * get response of customcommand
     * @param {string} commandname 
     * @returns {string|undefined} response
     */
    getCcmd(commandname) {
        let data = this.statements.get("getCcmd").get({ commandname })
        return data ? data.response : undefined
    }
    /**
     * get mod customcommand response
     * @param {string} commandname 
     * @returns {string|undefined} response
     */
    getCom(commandname) {
        let data = this.statements.get("getCom").get({ commandname })
        return data ? data.response : undefined
    }
    /**
     * Create new Customcommand/change its response
     * @param {string} commandname 
     * @param {string} response 
     */
    newCcmd(commandname, response) { this.statements.get("newCcmd").run({ commandname, response }) }
    /**
     * Create new mod Customcommand/change its response
     * @param {string} commandname 
     * @param {string} response 
     */
    newCom(commandname, response) { this.statements.get("newCom").run({ commandname, response }) }
    /**
     * delete a mod Customcommand
     * @param {string} commandname 
     */
    delCom(commandname) { this.statements.get("delCom").run({ commandname }) }
    /**
     * delete a Customcommand
     * @param {string} commandname 
     */
    delCcmd(commandname) {
        this.statements.get("delCcmd").run({ commandname })
        this.statements.get("delAliases").run({ command: commandname })
    }
    /**
     * delete an Alias
     * @param {string} name 
     */
    delAlias(name) { this.statements.get("delAlias").run({ name }) }
    /**
     * backup all databases
     */
    async backup() {
        var date = new Date()
        var month = '' + (date.getMonth() + 1);
        var day = '' + date.getDate();
        var year = date.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        var dateString = [year, month, day].join('-') + date.toLocaleTimeString("de-DE", { hour12: false })
        console.log("backing up watchtime")
        await this.watchtimedb.backup(`backup/${dateString}.watchtime.sqlite`)
        console.log("backed up watchtime")
        console.log("backing up customcommands")
        await this.customcommands.backup(`backup/${dateString}.customcommands.sqlite`)
        console.log("backed up customcommands")
    }
    /**
     * stop all Databases 
     */
    stop() {
        var stopping = []
        stopping.push(this.customcommands.close())
        stopping.push(this.watchtimedb.close())
        stopping.push(this.monthlyWatchtime.close())
        return Promise.all(stopping)
    }
}