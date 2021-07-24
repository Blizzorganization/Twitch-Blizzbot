const Database = require("better-sqlite3");
const { existsSync, mkdirSync } = require("fs");
const schedule = require("node-schedule");

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
 * @property {Object<string, Statement>} statements
 * @property {string[]} watchtimechannels
 */
exports.DB = class DB {
    customcommands;
    watchtimedb;
    monthlyWatchtime;
    statements = new Object({});
    watchtimechannels = [];
    userLink;
    constructor() {
        if (!(existsSync("./data"))) mkdirSync("./data");
        if (!(existsSync("./data/watchtime"))) mkdirSync("./data/watchtime");
        this.customcommands = new Database("data/customcommands.sqlite");
        this.watchtimedb = new Database("data/watchtime.sqlite");
        this.userLink = new Database("data/userLink.sqlite");
        this.customcommands.pragma("synchronous = 1");
        this.watchtimedb.pragma("synchronous = 1");
        this.userLink.pragma("synchronous = 1");
        this.customcommands.pragma("journal_mode = wal");
        this.watchtimedb.pragma("journal_mode = wal");
        this.userLink.pragma("journal_mode = wal");
        var date = new Date();
        var month = '' + (date.getMonth() + 1);
        var year = date.getFullYear();
        if (month.length < 2) month = '0' + month;
        this.monthlyWatchtime = new Database(`data/watchtime/${year}.${month}.sqlite`);
        this.monthlyWatchtime.pragma("synchronous = 1");
        this.monthlyWatchtime.pragma("journal_mode = wal");
        this.customcommands.prepare("CREATE TABLE IF NOT EXISTS aliases (name text PRIMARY KEY, command text);").run();
        this.customcommands.prepare("CREATE TABLE IF NOT EXISTS ccmds (commandname text PRIMARY KEY, response text);").run();
        this.customcommands.prepare("CREATE TABLE IF NOT EXISTS coms (commandname text PRIMARY KEY, response text);").run();
        this.userLink.prepare("CREATE TABLE IF NOT EXISTS users (discordid text PRIMARY KEY, twitchname text)").run();
        this.statements["newAlias"] = this.customcommands.prepare("INSERT OR IGNORE INTO aliases VALUES (@name, @command)");
        this.statements["getAlias"] = this.customcommands.prepare("SELECT command FROM aliases WHERE name = @name;");
        this.statements["getAliases"] = this.customcommands.prepare("SELECT name FROM aliases");
        this.statements["delAlias"] = this.customcommands.prepare("DELETE FROM aliases WHERE name = @name");
        this.statements["delAliases"] = this.customcommands.prepare("DELETE FROM aliases WHERE command = @command");
        this.statements["getCcmd"] = this.customcommands.prepare("SELECT response FROM ccmds WHERE commandname = @commandname");
        this.statements["getCom"] = this.customcommands.prepare("SELECT response FROM coms WHERE commandname = @commandname");
        this.statements["allCcmds"] = this.customcommands.prepare("SELECT commandname FROM ccmds");
        this.statements["allComs"] = this.customcommands.prepare("SELECT commandname FROM coms");
        this.statements["newCcmd"] = this.customcommands.prepare("INSERT INTO ccmds VALUES (@commandname, @response)");
        this.statements["newCom"] = this.customcommands.prepare("INSERT INTO coms VALUES (@commandname, @response)");
        this.statements["editCcmd"] = this.customcommands.prepare("UPDATE ccmds SET response = @response WHERE commandname = @commandname");
        this.statements["editCom"] = this.customcommands.prepare("UPDATE coms SET response = @response WHERE commandname = @commandname");
        this.statements["delCcmd"] = this.customcommands.prepare("DELETE FROM ccmds WHERE commandname = @commandname");
        this.statements["delCom"] = this.customcommands.prepare("DELETE FROM coms WHERE commandname = @commandname");
        this.statements["newDiscordConnection"] = this.userLink.prepare("INSERT OR REPLACE INTO users VALUES (@id, @twitchname)");
        this.statements["getDiscordConnection"] = this.userLink.prepare("SELECT twitchname FROM users WHERE discordid = @id");
        schedule.scheduleJob("newMonthlyWatchtime", "0 0 1 * *", async () => {
            await this.monthlyWatchtime.close();
            this.monthlyWatchtime = new Database(`data/watchtime/${year}.${month}.sqlite`);
            this.monthlyWatchtime.pragma("synchronous = 1");
            this.monthlyWatchtime.pragma("journal_mode = wal");
            for (const channel of this.watchtimechannels) {
                this.mWatchtimeSetup(channel);
            }
        });
    }
    /**
     * setup monthly watchtime Table and prepare statements
     * @param {string} channel Twitch Channel Name
     */
    mWatchtimeSetup(channel) {
        this.monthlyWatchtime.prepare(`CREATE TABLE IF NOT EXISTS ${channel} (user text PRIMARY KEY, watchtime number);`).run();
        this.statements[`getMWatchtimeFor${channel}`] = this.monthlyWatchtime.prepare(`SELECT watchtime FROM ${channel} WHERE user = @user`);
        this.statements[`mwatchtimeNewFor${channel}`] = this.monthlyWatchtime.prepare(`INSERT OR IGNORE INTO ${channel} VALUES (@user, 0);`);
        this.statements[`mwatchtimeIncFor${channel}`] = this.monthlyWatchtime.prepare(`UPDATE ${channel} SET watchtime = watchtime + 1 WHERE user = @user`);
        this.statements[`mwatchtimeListFor${channel}`] = this.monthlyWatchtime.prepare("SELECT user, watchtime FROM <channel> ORDER BY watchtime DESC LIMIT @max".replace("<channel>", channel));
    }
    /**
     * adds an Alias to a custom command
     * @param {string} name name of the Alias
     * @param {string} command Command the alias refers to
     */
    newAlias(name, command) { this.statements["newAlias"].run({ name, command }); }
    /**
     * resolve an alias
     * @param {string} name 
     * @returns {string|undefined} the command the alias refers to if the alias exists
     */
    getAlias(name) {
        let data = this.statements["getAlias"].get({ name });
        return data ? data.command : undefined;
    }
    /**
     * delete an alias
     * @param {string} name Name of the Alias to delete
     */
    deleteAlias(name) { this.statements["deleteAlias"].run({ name }); }
    /**
     * Get all existing aliases
     * @returns {string[]} List of all Aliases
     */
    getAliases() { return this.statements["getAliases"].all().map((row) => row.name); }
    /**
     * Generate Watchtime Table and prepare statements
     * @param {string} channel Twitch Channel Name
     */
    newWatchtimeChannel(channel) {
        if (channel.includes("#")) channel = channel.replace("#", "");
        this.watchtimedb.prepare(`CREATE TABLE IF NOT EXISTS ${channel} (user text PRIMARY KEY, watchtime number);`).run();
        this.statements[`getWatchtimeFor${channel}`] = this.watchtimedb.prepare(`SELECT watchtime FROM ${channel} WHERE user = @user`);
        this.statements[`watchtimeNewFor${channel}`] = this.watchtimedb.prepare(`INSERT OR IGNORE INTO ${channel} VALUES (@user, 0);`);
        this.statements[`watchtimeIncFor${channel}`] = this.watchtimedb.prepare(`UPDATE ${channel} SET watchtime = watchtime + 1 WHERE user = @user`);
        this.statements[`watchtimeListFor${channel}`] = this.watchtimedb.prepare("SELECT user, watchtime FROM <channel> ORDER BY watchtime DESC LIMIT @max".replace("<channel>", channel));
        this.mWatchtimeSetup(channel);
        this.watchtimechannels.push(channel);
    }
    /**
     * get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {number} max Amount of Viewers to fetch
     * @returns {watchtimeuser[]} Sorted Watchtime List
     */
    watchtimeList(channel, max) {
        if (!("number" == typeof max)) throw new TypeError("You have to select how many entries you need as a number.");
        return this.statements[`watchtimeListFor${channel}`].all({ max });
    }
    /**
     * get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {number} max Amount of Viewers to fetch
     * @returns {watchtimeuser[]} Sorted Watchtime List
     */
    mwatchtimeList(channel, max) {
        if (!("number" == typeof max)) throw new TypeError("You have to select how many entries you need as a number.");
        return this.statements[`mwatchtimeListFor${channel}`].all({ max });
    }
    /**
     * Default Watchtime Increase (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {string[]} chatters List of Users to add Watchtime to
     */
    watchtime(channel, chatters) {
        if (channel.includes("#")) channel = channel.replace("#", "");
        var watchtimenewstatement = this.statements[`watchtimeNewFor${channel}`];
        var watchtimeincstatement = this.statements[`watchtimeIncFor${channel}`];
        var mwatchtimenewstatement = this.statements[`mwatchtimeNewFor${channel}`];
        var mwatchtimeincstatement = this.statements[`mwatchtimeIncFor${channel}`];
        var transaction = this.watchtimedb.transaction((users) => {
            for (const user of users) {
                watchtimenewstatement.run({ channel, user });
                watchtimeincstatement.run({ channel, user });
                mwatchtimenewstatement.run({ channel, user });
                mwatchtimeincstatement.run({ channel, user });
            }
        });
        transaction(chatters);
    }
    /**
     * get Watchtime for User on Channel
     * @param {string} channel 
     * @param {string} user 
     * @returns {number|undefined} watchtime of the user
     */
    getWatchtime(channel, user) {
        if (channel.includes("#")) channel = channel.replace("#", "");
        let data = this.statements[`getWatchtimeFor${channel}`].get({ user });
        return data ? data.watchtime : undefined;
    }
    /**
     * get monthly Watchtime for User on Channel
     * @param {string} channel 
     * @param {string} user 
     * @returns {number|undefined} watchtime of the user
     */
    getMWatchtime(channel, user) {
        if (channel.includes("#")) channel = channel.replace("#", "")
        let data = this.statements[`getMWatchtimeFor${channel}`].get({ user })
        return data ? data.watchtime : undefined;
    }
    /**
     * get all customcommands
     * @returns {string[]} list of customcommands
     */
    allCcmds() { return this.statements["allCcmds"].all().map((row) => row.commandname); }
    /**
     * get all mod customcommands
     * @returns {string[]} list of mod customcommands
     */
    allComs() { return this.statements["allComs"].all().map((row) => row.commandname); }
    /**
     * get response of customcommand
     * @param {string} commandname 
     * @returns {string|undefined} response
     */
    getCcmd(commandname) {
        let data = this.statements["getCcmd"].get({ commandname });
        return data ? data.response : undefined;
    }
    /**
     * get mod customcommand response
     * @param {string} commandname 
     * @returns {string|undefined} response
     */
    getCom(commandname) {
        let data = this.statements["getCom"].get({ commandname });
        return data ? data.response : undefined;
    }
    /**
     * Create new Customcommand/change its response
     * @param {string} commandname 
     * @param {string} response 
     */
    newCcmd(commandname, response) { this.statements["newCcmd"].run({ commandname, response }); }
    /**
     * Create new mod Customcommand/change its response
     * @param {string} commandname 
     * @param {string} response 
     */
    newCom(commandname, response) { this.statements["newCom"].run({ commandname, response }); }
    /**
    * Edit a Customcommand/change its response
    * @param {string} commandname 
    * @param {string} response 
    */
    editCcmd(commandname, response) { this.statements["editCcmd"].run({ commandname, response }); }
    /**
     * Edit a mod Customcommand/change its response
     * @param {string} commandname 
     * @param {string} response 
     */
    editCom(commandname, response) { this.statements["editCom"].run({ commandname, response }); }
    /**
     * delete a mod Customcommand
     * @param {string} commandname 
     */
    delCom(commandname) { this.statements["delCom"].run({ commandname }); }
    /**
     * delete a Customcommand
     * @param {string} commandname 
     */
    delCcmd(commandname) {
        this.statements["delCcmd"].run({ commandname });
        this.statements["delAliases"].run({ command: commandname });
    }
    /**
     * delete an Alias
     * @param {string} name 
     */
    delAlias(name) { this.statements["delAlias"].run({ name }); }
    /**
     * get linked twitch account if exists, otherwise returns null
     * @param {User} user discord user
     * @returns {string | null} twitch username
     */
    getDiscordConnection(user) {
        var data = this.statements["getDiscordConnection"].get({ id: user.id });
        return data ? data.twitchname : null;
    }
    /**
     * Set a twitch user to your discord user
     * @param {User} user discord user 
     * @param {string} twitchname twitch username
     */
    newDiscordConnection(user, twitchname) {
        this.statements["newDiscordConnection"].run({ id: user.id, twitchname });
    }
    /**
     * backup all databases
     */
    async backup() {
        var date = new Date();
        var month = '' + (date.getMonth() + 1);
        var day = '' + date.getDate();
        var year = date.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        var dateString = [year, month, day].join('-') + date.toLocaleTimeString("de-DE", { hour12: false });
        console.log("backing up watchtime");
        await this.watchtimedb.backup(`backup/${dateString}.watchtime.sqlite`);
        console.log("backed up watchtime");
        console.log("backing up customcommands");
        await this.customcommands.backup(`backup/${dateString}.customcommands.sqlite`);
        console.log("backed up customcommands");
    }
    /**
     * stop all Databases 
     */
    stop() {
        var stopping = [];
        stopping.push(this.customcommands.close());
        stopping.push(this.watchtimedb.close());
        stopping.push(this.monthlyWatchtime.close());
        return Promise.all(stopping);
    }
};