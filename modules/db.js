const { Pool } = require("pg");
const { permissions } = require("./constants");
const { currentMonth } = require("./functions");
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
 * @typedef cmdData
 * @property {string} commandname
 * @property {string} response
 * @property {number} permissions
 */

class DB {
    #statements; /* eslint-ignore*/
    /**
     * @class DB
     * Database class - currently based on postgres
     * @property {import("./statements").statements} #statements
     * @property {config} #config
     */
    constructor(config) {
        this.#statements = require("./statements.json");
        this.doingWatchtime = false;
        this.db = new Pool(config);
        this.dbname = config.database;
        /** @type {import("./clients").Clients}*/
        this.clients = undefined;
        this.#ensureTables();
    }
    /**
     * @param {string} sql
     * @param {any[]} data
     */
    async query(sql, ...data) {
        const client = await this.db.connect();
        try {
            const res = await client.query(sql, data).catch(e => { throw e; });
            return res;
        } catch (e) {
            this.clients.logger.error(e?.toString());
        } finally {
            client.release();
        }
    }
    /**
     * initializes the Database
     */
    async #ensureTables() {
        const client = await this.db.connect();
        try {
            const tables = (await client.query("SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';")).rows;
            this.clients.logger.log("debug", "Existing databases: " + tables.map(t => t.tablename).join(", "));
            let todoTables = [
                ["streamer", "CREATE TABLE streamer (name VARCHAR(25) PRIMARY KEY, automessage BOOLEAN DEFAULT TRUE);"],
                ["watchtime", `CREATE TABLE watchtime
                (channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
                viewer VARCHAR(25) NOT NULL,
                watchtime INTEGER DEFAULT 0,
                month VARCHAR(7) NOT NULL,
                PRIMARY KEY(channel, viewer, month));`],
                ["customcommands", `CREATE TABLE customcommands
                (channel VARCHAR(25) NOT NULL references streamer(name),
                command TEXT NOT NULL,
                response TEXT,
                permissions INTEGER,
                PRIMARY KEY(channel, command));`],
                ["aliases", `CREATE TABLE aliases
                (alias TEXT,
                command TEXT NOT NULL,
                channel VARCHAR(25) NOT NULL,
                PRIMARY KEY(channel, alias),
                FOREIGN KEY(channel, command) REFERENCES customcommands(channel, command) ON UPDATE CASCADE ON DELETE CASCADE);`],
                ["counters", `CREATE TABLE counters
                (channel VARCHAR(25) NOT NULL references streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
                name TEXT,
                cur INTEGER DEFAULT 0,
                inc INTEGER DEFAULT 1,
                PRIMARY KEY(channel, name));`],
                ["userlink", `CREATE TABLE userlink
                (discordid VARCHAR(30) PRIMARY KEY,
                twitchname VARCHAR(25) NOT NULL);`],
                ["blacklist", `create table blacklist  
                (channel VARCHAR(25) REFERENCES streamer(name) ON DELETE CASCADE ON UPDATE CASCADE,
                blwords TEXT [],
                UNIQUE(channel));`],
            ];
            if (tables && tables.length > 0) {
                /** @type {string[]}*/
                const tablenames = tables.map(t => t.tablename);
                todoTables = todoTables.filter((val) => tablenames.indexOf(val[0]) == -1);
            }
            for (const stmt of todoTables) {
                this.clients.logger.log("debug", "creating table " + stmt[0]);
                client.query(stmt[1]);
            }
        } catch (e) {
            this.clients.logger.error(e);
            throw e;
        } finally {
            client.release();
        }
    }
    /**
     * stops the database
     */
    stop() {
        return this.db.end();
    }
    /**
     * add a new channel to the database
     * @param {string} channel
     */
    async newChannel(channel) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.newChannel, [channel, true]).catch((e) => { throw e; });
            await client.query(this.#statements.newBlacklist, [channel]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * add a new channel to the database
     * @param {string} channel
     */
    async getChannel(channel) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const data = await client.query(this.#statements.getChannel, [channel]).catch((e) => { throw e; });
            return data.rows.length == 0 ? null : data.rows[0];
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    // #region Aliases
    /**
     * adds an Alias to a custom command
     * @param {string} channel Channel where to add the Alias
     * @param {string} name name of the Alias
     * @param {string} command Command the alias refers to
     */
    async newAlias(channel, name, command) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.newAlias, [channel, name, command]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<resolvedAlias?>} command data
     */
    async resolveAlias(channel, name) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const data = await client.query(this.#statements.resolveAlias, [name, channel]).catch((e) => { throw e; });
            return data.rows.length == 0 ? null : data.rows[0];
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * delete an alias
     * @param {string} name Name of the Alias to delete
     * @param {string} channel
     */
    async deleteAlias(channel, name) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.delAlias, [channel, name]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * Get all existing aliases
     * @param {string} channel
     * @returns {Promise<{channel: string, command: string, alias: string}[]>} List of all Aliases
     */
    async getAliases(channel) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            return (await client.query(this.#statements.getAliases, [channel]).catch((e) => { throw e; }))?.rows || [];
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    // #endregion aliasses

    // #region counters
    /**
     * creates a new counter
     * @param  {string} channel channel to create the counter for
     * @param  {string} name counter name
     * @param  {number} inc=1 the automatic increase
     * @param  {number} defaultVal=0 the starting value
     */
    async newCounter(channel, name, inc = 1, defaultVal = 0) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.newCounter, [channel, name, defaultVal, inc]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * read only, does NOT modify the value
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<number?>} value if exists
     */
    async readCounter(channel, name) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const data = await client.query(this.#statements.getCounter, [name, channel]).catch((e) => { throw e; });
            if (data.rows.length == 0) return;
            return data.rows[0].cur;
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @returns {Promise<number?>}
     */
    async getCounter(channel, name) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const data = await client.query(this.#statements.getCounter, [name, channel]).catch((e) => { throw e; });
            if (data.rows.length == 0) return;
            await client.query(this.#statements.incCounter, [name, channel]).catch((e) => { throw e; });
            return data.rows[0]?.cur;
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @param  {number} val
     */
    async setCounter(channel, name, val) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.setCounter, [val, name, channel]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     */
    async delCounter(channel, name) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.delCounter, [channel, name]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e.message);
        } finally {
            client.release();
        }
    }

    async allCounters(channel) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const data = await client.query(this.#statements.allCounters, [channel]).catch((e) => { throw e; });
            return data.rows;
        } catch (e) {
            this.clients.logger.error(e.message);
        } finally {
            client.release();
        }
    }
    // #endregion counters

    // #region Customcommands
    /**
     * get all customcommands
     * @returns {Promise<string[]>} list of customcommands
     * @param {string} channel
     * @param {number} permission
     */
    async allCcmds(channel, permission = permissions.user) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            return (await client.query(this.#statements.getAllCommands, [channel, permission]).catch((e) => { throw e; }))?.rows?.map((row) => row.command);
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * get response of customcommand
     * @param {string} commandname
     * @param {string} channel
     * @returns {Promise<?cmdData>} response
     */
    async getCcmd(channel, commandname) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const data = await client.query(this.#statements.getCommand, [commandname, channel]).catch((e) => { throw e; });
            return data.rows.length > 0 ? data.rows[0] : undefined;
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * Create new Customcommand/change its response
     * @param {string} channel
     * @param {string} commandname
     * @param {string} response
     * @param {number} perms
     */
    async newCcmd(channel, commandname, response, perms) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.newCommand, [commandname, response, channel, perms]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * @param  {cmdData[]} cmdData
     * @param  {string} channel
     * @param  {"user"|"mod"} cmdType
     */
    async migrateCustomcommands(cmdData, channel, cmdType) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/, "");
            (async (cmds) => {
                await client.query("BEGIN");
                for (const cmd of cmds) {
                    await client.query(this.#statements.newCommand, [cmd.commandname, cmd.response, channel, permissions[cmdType]]).catch((e) => { throw e; });
                }
                return await client.query("COMMIT").catch((e) => { throw e; });
            })(cmdData);
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
    * Edit a Customcommand/change its response
    * @param {string} channel
    * @param {string} commandname
    * @param {string} response
    */
    async editCcmd(channel, commandname, response) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.updateCommand, [response, commandname, channel]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * delete a Customcommand
     * @param {string} channel
     * @param {string} commandname
     */
    async delCcmd(channel, commandname) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.deleteCommand, [commandname, channel]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * transfers a customcommande to another permission level
     * @param  {string} channel
     * @param  {string} commandname
     */
    async transferCmd(channel, commandname) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const cmd = await client.query(this.#statements.getCommandPermission, [commandname, channel]).catch((e) => { throw e; });
            if (cmd?.rows?.length == 0) {
                return "no_such_command";
            }
            const newPerm = cmd.rows[0].permissions == permissions.user ? permissions.mod : permissions.user;
            await client.query(this.#statements.changeCommandPermissions, [newPerm, commandname, channel]).catch((e) => { throw e; });
            return "ok";
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    // #endregion Customcommands

    // #region watchtime
    /**
     * Default Watchtime Increase (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {string[]} chatters List of Users to add Watchtime to
     */
    async watchtime(channel, chatters) {
        if (this.doingWatchtime) {
            return this.clients.logger.error("watchtime already in progress at " + (new Date).toLocaleTimeString());
        }
        this.doingWatchtime = true;
        const client = await this.db.connect();
        try {
            const started = new Date;
            this.clients.logger.log("debug", "starting watchtime at " + started.toLocaleTimeString());
            channel = channel.replace(/#+/, "");
            const month = currentMonth();
            (async (users) => {
                await client.query("BEGIN");
                await client.query(this.#statements.watchtimeNew, [channel, users, month]).catch((e) => {
                    this.clients.logger.error("insert month" + e?.toString());
                    client.query("ROLLBACK");
                });
                await client.query(this.#statements.watchtimeNew, [channel, users, "alltime"]).catch((e) => {
                    this.clients.logger.error("insert alltime" + e?.toString());
                    client.query("ROLLBACK");
                });
                await client.query(this.#statements.watchtimeInc, [users, channel, month]).catch((e) => {
                    this.clients.logger.error("inc month" + e?.toString());
                    client.query("ROLLBACK");
                });
                await client.query(this.#statements.watchtimeInc, [users, channel, "alltime"]).catch((e) => {
                    this.clients.logger.error("inc alltime" + e?.toString());
                    client.query("ROLLBACK");
                });
                client.query("COMMIT").catch((e) => { throw e; });
            })(chatters);
            const endtime = new Date;
            this.clients.logger.log("debug", "finished watchtime at " + endtime.toLocaleTimeString() + EOL + "Took " + (endtime.getTime() - started.getTime()) + "ms.");
        } catch (e) {
            this.clients.logger.error(e?.toString());
        } finally {
            client.release();
            this.doingWatchtime = false;
        }
    }
    /**
     * rename a watchtime user
     * @param {string} channel Channel where to rename the viewer
     * @param {string} oldName previous name of the viewer
     * @param {string} newName new name to change to
     */
    async renameWatchtimeUser(channel, oldName, newName) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            await client.query(this.#statements.renameWatchtimeUser, [channel, oldName, newName]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /** @typedef old_watchtime
     * @property {number} watchtime
     * @property {string} user
    */
    /**
     * Watchtime migration method (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {old_watchtime[]} chatters List of Users to add Watchtime to
     * @param {string} month The month to add the watchtime at
     */
    async migrateWatchtime(channel, chatters, month) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/, "");
            (async (users) => {
                await client.query("BEGIN");
                const usernames = users.map((u) => u.user);
                await client.query(this.#statements.watchtimeNew, [channel, usernames, month]).catch((e) => { throw e; });
                for (const user of users) {
                    await client.query(this.#statements.watchtimeIncBy, [user.user, channel, month, user.watchtime]).catch((e) => { throw e; });
                }
                return await client.query("COMMIT").catch((e) => { throw e; });
            })(chatters);
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {number} max Amount of Viewers to fetch
     * @param {number} page
     * @returns {Promise<watchtimeuser[]>} Sorted Watchtime List
     * @param {string | number} month
     */
    async watchtimeList(channel, month, max, page = 1) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            if (!(typeof max == "number")) throw new TypeError("You have to select how many entries you need as a number.");
            if (!(typeof page == "number")) throw new TypeError("You need to supply a number as page");
            return (await client.query(this.#statements.watchtimeList, [month, channel, max, (page - 1) * max]).catch((e) => { throw e; }))?.rows;
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * get Watchtime for User on Channel
     * @param {string} channel
     * @param {string} user
     * @returns {Promise<?number>} watchtime of the user
     * @param {string} [month]
     */
    async getWatchtime(channel, user, month = "alltime") {
        const client = await this.db.connect();
        try {
            channel = channel.replace("#", "");
            const data = await client.query(this.#statements.getWatchtime, [user, channel, month]).catch((e) => { throw e; });
            return data.rows.length > 0 ? data.rows[0].watchtime : undefined;
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    // #endregion watchtime
    /**
     * get linked twitch account if exists, otherwise returns null
     * @param {import("discord.js").User} user discord user
     * @returns {Promise<string | null>} twitch username
     */
    async getDiscordConnection(user) {
        const client = await this.db.connect();
        try {
            const data = await client.query(this.#statements.getDiscordConnection, [user.id]).catch((e) => { throw e; });
            return data?.rows?.length > 0 ? data.rows[0].twitchname : null;
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * Set a twitch user to your discord user
     * @param {import("discord.js").User} user discord user
     * @param {string} twitchname twitch username
     */
    async newDiscordConnection(user, twitchname) {
        const client = await this.db.connect();
        try {
            await client.query(this.#statements.newDiscordConnection, [user.id, twitchname]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * @param  {import("discord.js").User} user
     */
    async deleteDiscordConnection(user) {
        const client = await this.db.connect();
        try {
            await client.query(this.#statements.deleteDiscordConnection, [user.id]).catch((e) => { throw e; });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    // #region blacklist
    async saveBlacklist() {
        const channels = this.clients.twitch.channels;
        const client = await this.db.connect();
        try {
            (async () => {
                await client.query("BEGIN");
                for (let channel of channels) {
                    channel = channel.replace(/#+/, "");
                    const blacklist = this.clients.twitch.blacklist[channel];
                    await client.query(this.#statements.saveBlacklist, [channel, blacklist]).catch((e) => { throw e; });
                }
                return await client.query("COMMIT").catch((e) => { throw e; });
            })();
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    async loadBlacklist() {
        const client = await this.db.connect();
        try {
            const data = (await client.query(this.#statements.loadBlacklist).catch((e) => { throw e; }))?.rows;
            data.forEach((b) => {
                this.clients.twitch.blacklist[b.channel] = b.blwords;
            });
        } catch (e) {
            this.clients.logger.error(e);
        } finally {
            client.release();
        }
    }
    // #endregion
}
exports.DB = DB;