import _ from "lodash";
import pg from "pg";
import { permissions } from "./constants.js";
import { currentMonth } from "./functions.js";
import { logger } from "./logger.js";
import { statements } from "./statements.js";
/**
 * @typedef watchtimeuser
 * @property {string} viewer
 * @property {number} watchtime
 */

const { Pool } = pg;

/**
 * The Database class
 * @class DB
 */
export class DB {
    /**
     * @param {import("../typings/dbtypes.js").Config} config
     */
    constructor(config) {
        this.doingWatchtime = false;
        this.db = new Pool(config);
        this.dbname = config.database;
        /** @type {import("./clients.js").Clients}*/
        this.clients = undefined;
        this.ensureTables().catch((e) => {
            logger.error("Failed to ensure tables: ", e);
        });
    }
    /**
     * initializes the Database
     */
    async ensureTables() {
        const client = await this.db.connect();
        try {
            const tables = (
                await client.query(
                    "SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';",
                )
            ).rows;
            logger.debug(`Existing databases: ${tables.map((t) => t.tablename).join(", ")}`);
            let todoTables = [
                [
                    "streamer",
                    `CREATE TABLE streamer
                    (
                        name VARCHAR(25) PRIMARY KEY,
                        automessage BOOLEAN DEFAULT TRUE
                    );`,
                ],
                [
                    "watchtime",
                    `CREATE TABLE watchtime
                    (
                        channel VARCHAR(25) NOT NULL
                            REFERENCES streamer(name)
                            ON UPDATE CASCADE ON DELETE CASCADE,
                        viewer VARCHAR(25) NOT NULL,
                        watchtime INTEGER DEFAULT 0,
                        month VARCHAR(7) NOT NULL,
                        PRIMARY KEY(channel, viewer, month)
                    );`,
                ],
                [
                    "customcommands",
                    `CREATE TABLE customcommands
                    (
                        channel VARCHAR(25) NOT NULL
                            references streamer(name),
                        command TEXT NOT NULL,
                        response TEXT,
                        permissions INTEGER,
                        PRIMARY KEY(channel, command)
                    );`,
                ],
                [
                    "aliases",
                    `CREATE TABLE aliases
                    (
                        alias TEXT,
                        command TEXT NOT NULL,
                        channel VARCHAR(25) NOT NULL,
                        PRIMARY KEY(channel, alias),
                        FOREIGN KEY(channel, command)
                            REFERENCES customcommands(channel, command)
                            ON UPDATE CASCADE ON DELETE CASCADE
                    );`,
                ],
                [
                    "counters",
                    `CREATE TABLE counters
                    (
                        channel VARCHAR(25) NOT NULL
                            references streamer(name)
                            ON UPDATE CASCADE
                            ON DELETE CASCADE,
                        name TEXT,
                        cur INTEGER DEFAULT 0,
                        inc INTEGER DEFAULT 1,
                        PRIMARY KEY(channel, name)
                    );`,
                ],
                [
                    "userlink",
                    `CREATE TABLE userlink
                    (
                        discordid VARCHAR(30) PRIMARY KEY,
                        twitchname VARCHAR(25) NOT NULL
                    );`,
                ],
                [
                    "blacklist",
                    `CREATE TABLE blacklist
                    (
                        channel VARCHAR(25)
                            REFERENCES streamer(name)
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
                        blword TEXT,
                        action SMALLINT NOT NULL DEFAULT 0,
                        UNIQUE(channel, blword)
                    );`,
                ],
                [
                    "commands",
                    `CREATE TABLE commands
                    (
                        channel VARCHAR(25) REFERENCES streamer(name) ON DELETE CASCADE ON UPDATE CASCADE,
                        permission INT NOT NULL DEFAULT 0,
                        command TEXT NOT NULL,
                        enabled BOOLEAN DEFAULT true,
                        UNIQUE(channel, command)
                    );`,
                ],
            ];
            if (tables && tables.length > 0) {
                /** @type {string[]}*/
                const tablenames = tables.map((t) => t.tablename);
                todoTables = todoTables.filter((val) => tablenames.indexOf(val[0]) == -1);
            }
            for (const stmt of todoTables) {
                logger.debug(`creating table ${stmt[0]}`);
                await client.query(stmt[1]);
            }
        } catch (e) {
            logger.error(e);
            throw e;
        } finally {
            client.release();
        }
    }
    /**
     * stops the database
     * @returns {Promise<void>} the promise of the closing database
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
            await client.query(statements.channels.newChannel, [channel, true]).catch((e) => {
                throw e;
            });
        } catch (e) {
            logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * add a new channel to the database
     * @param {string} channel
     * @returns {Promise<import("../typings/dbtypes.js").streamer>} the config of the channel
     */
    async getChannel(channel) {
        const data = await this.db.query(statements.channels.getChannel, [channel]).catch((e) => {
            logger.error(e);
        });
        if (!data) return null;
        return data.rows.length == 0 ? null : data.rows[0];
    }
    // #region Aliases
    /**
     * adds an Alias to a custom command
     * @param {string} channel Channel where to add the Alias
     * @param {string} name name of the Alias
     * @param {string} command Command the alias refers to
     */
    async newAlias(channel, name, command) {
        channel = channel.replace(/#+/g, "");
        await this.db.query(statements.aliases.newAlias, [channel, name, command]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<import("../typings/dbtypes.js").ResolvedAlias|null>} command data
     */
    async resolveAlias(channel, name) {
        channel = channel.replace(/#+/g, "");
        try {
            /** @type {import("pg").QueryResult<import("../typings/dbtypes.js").ResolvedAlias>} */
            const data = await this.db.query(statements.aliases.resolveAlias, [name, channel]);
            if (!data) return null;
            const { rows } = data;
            return data.rowCount == 0 ? null : rows[0];
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * find Alias
     * @param {string} channel Channel where to add the Alias
     * @param {string} command Command the alias refers to
     * @returns {Promise<string[]>} string returns
     */
    async findRelatedAliases(channel, command) {
        try {
            channel = channel.replace(/#+/g, "");
            /** @type {import("pg").QueryResult<import("../typings/dbtypes.js").Alias>} */
            const data = await this.db.query(statements.aliases.findRelated, [channel, command]);
            const { rows } = data;
            return rows.map((row) => row.alias);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * delete an alias
     * @param {string} channel
     * @param {string} name Name of the Alias to delete
     */
    async deleteAlias(channel, name) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.aliases.delAlias, [channel, name]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * Get all existing aliases
     * @param {string} channel
     * @returns {Promise<import("../typings/dbtypes.js").Alias[]>} List of all Aliases
     */
    async getAliases(channel) {
        try {
            channel = channel.replace(/#+/g, "");
            /** @type {import("pg").QueryResult<import("../typings/dbtypes.js").Alias>} */
            const data = await this.db.query(statements.aliases.getAliases, [channel]);
            return data?.rows || [];
        } catch (e) {
            logger.error(e);
        }
    }
    // #endregion aliasses

    // #region counters
    /**
     * creates a new counter
     * @param  {string} channel channel to create the counter for
     * @param  {string} name counter name
     * @param {number} [inc] the automatic increase
     * @param {number} [defaultVal] the starting value
     */
    async newCounter(channel, name, inc = 1, defaultVal = 0) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.counters.newCounter, [channel, name, defaultVal, inc]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * read only, does NOT modify the value
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<number?>} value if exists
     */
    async readCounter(channel, name) {
        try {
            channel = channel.replace(/#+/g, "");
            /** @type {import("pg").QueryResult<Pick<import("../typings/dbtypes.js").Counter, "cur">>} */
            const data = await this.db.query(statements.counters.getCounter, [name, channel]);
            if (!data || data.rows.length === 0) return;
            return data.rows[0].cur;
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @returns {Promise<number?>} the counter value
     */
    async getCounter(channel, name) {
        try {
            channel = channel.replace(/#+/g, "");
            /** @type {import("pg").QueryResult<Pick<import("../typings/dbtypes.js").Counter, "cur">>} */
            const data = await this.db.query(statements.counters.incCounter, [name, channel]);
            return data?.rows[0]?.cur;
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @param  {number} val
     */
    async setCounter(channel, name, val) {
        channel = channel.replace(/#+/g, "");
        await this.db.query(statements.counters.setCounter, [val, name, channel]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @param  {number} inc
     */
    async editCounter(channel, name, inc) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.counters.editCounter, [inc, name, channel]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     */
    async delCounter(channel, name) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.counters.delCounter, [channel, name]);
        } catch (e) {
            logger.error(e.message);
        }
    }
    /**
     * @param  {string} channel
     * @returns {Promise<import("../typings/dbtypes.js").Counter[]>} a list of counters
     */
    async allCounters(channel) {
        try {
            channel = channel.replace(/#+/g, "");
            /** @type {import("pg").QueryResult<import("../typings/dbtypes.js").Counter>} */
            const data = await this.db.query(statements.counters.allCounters, [channel]);
            return data?.rows ?? [];
        } catch (e) {
            logger.error(e.message);
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
        channel = channel.replace(/#+/g, "");
        const data = await this.db.query(statements.customCommands.getAllCommands, [channel, permission]).catch((e) => {
            logger.error(e);
        });
        if (!data) return;
        /** @type {import("../typings/dbtypes.js").CustomCommand[]} */
        const rows = data.rows;
        return rows.map((row) => row.command);
    }
    /**
     * get response of customcommand
     * @param {string} channel
     * @param {string} commandname
     * @returns {Promise<?import("../typings/dbtypes.js").CustomCommand>} response
     */
    async getCcmd(channel, commandname) {
        channel = channel.replace(/#+/g, "");
        const data = await this.db.query(statements.customCommands.getCommand, [commandname, channel]).catch((e) => {
            logger.error(e);
        });
        if (!data) return undefined;
        return data.rows.length > 0 ? data.rows[0] : undefined;
    }
    /**
     * Create new Customcommand/change its response
     * @param {string} channel
     * @param {string} commandname
     * @param {string} response
     * @param {number} perms
     */
    async newCcmd(channel, commandname, response, perms) {
        channel = channel.replace(/#+/g, "");
        await this.db
            .query(statements.customCommands.newCommand, [commandname, response, channel, perms])
            .catch((e) => {
                logger.error(e);
            });
    }
    /**
     * @param  {import("../typings/dbtypes.js").CustomCommand[]} cmdData
     * @param  {string} channel
     * @param  {"user"|"mod"} cmdType
     */
    async migrateCustomcommands(cmdData, channel, cmdType) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/, "");
            await (async (cmds) => {
                await client.query("BEGIN");
                for (const cmd of cmds) {
                    await client
                        .query(statements.customCommands.newCommand, [
                            cmd.command,
                            cmd.response,
                            channel,
                            permissions[cmdType],
                        ])
                        .catch((e) => {
                            throw e;
                        });
                }
                return await client.query("COMMIT").catch((e) => {
                    throw e;
                });
            })(cmdData);
        } catch (e) {
            logger.error(e);
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
        channel = channel.replace(/#+/g, "");
        await this.db.query(statements.customCommands.updateCommand, [response, commandname, channel]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * Edit a Customcommand/change its name
     * @param {string} channel
     * @param {string} commandname
     * @param {string} newName
     */
    async renameCCmd(channel, commandname, newName) {
        channel = channel.replace(/#+/g, "");
        await this.db.query(statements.customCommands.renameCommand, [newName, commandname, channel]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * delete a Customcommand
     * @param {string} channel
     * @param {string} commandname
     */
    async delCcmd(channel, commandname) {
        channel = channel.replace(/#+/g, "");
        await this.db.query(statements.customCommands.deleteCommand, [commandname, channel]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * transfers a customcommande to another permission level
     * @param  {string} channel
     * @param  {string} commandname
     * @returns {Promise<"no_such_command"|"ok">}
     */
    async transferCmd(channel, commandname) {
        const client = await this.db.connect();
        try {
            channel = channel.replace(/#+/g, "");
            const cmd = await client.query(statements.customCommands.getCommandPermission, [commandname, channel]);

            if (cmd?.rows?.length == 0) {
                return "no_such_command";
            }
            const newPerm = cmd.rows[0].permissions == permissions.user ? permissions.mod : permissions.user;
            await client.query(statements.customCommands.changeCommandPermissions, [newPerm, commandname, channel]);
            return "ok";
        } catch (e) {
            logger.error(e);
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
            logger.error(`watchtime already in progress at ${new Date().toLocaleTimeString()}`);
            return;
        }
        this.doingWatchtime = true;
        const client = await this.db.connect();
        try {
            const started = new Date();
            logger.debug(`starting watchtime at ${started.toLocaleTimeString()}`);
            channel = channel.replace(/#+/, "");
            const month = currentMonth();
            await (async (users) => {
                await client.query("BEGIN");
                await client.query(statements.watchtime.watchtimeNew, [channel, users, month]).catch(async (e) => {
                    logger.error(`insert month ${e?.toString()}`);
                    await client.query("ROLLBACK");
                });
                await client.query(statements.watchtime.watchtimeNew, [channel, users, "alltime"]).catch(async (e) => {
                    logger.error(`insert alltime ${e?.toString()}`);
                    await client.query("ROLLBACK");
                });
                await client.query(statements.watchtime.watchtimeInc, [users, channel, month]).catch(async (e) => {
                    logger.error(`inc month ${e?.toString()}`);
                    await client.query("ROLLBACK");
                });
                await client.query(statements.watchtime.watchtimeInc, [users, channel, "alltime"]).catch(async (e) => {
                    logger.error(`inc alltime ${e?.toString()}`);
                    await client.query("ROLLBACK");
                });
                client.query("COMMIT").catch((e) => {
                    throw e;
                });
            })(chatters);
            const endtime = new Date();
            logger.debug(
                `finished watchtime at ${endtime.toLocaleTimeString()}
                Took ${endtime.getTime() - started.getTime()}ms.`,
            );
        } catch (e) {
            logger.error(e?.toString());
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
        channel = channel.replace(/#+/g, "");
        await this.db.query(statements.watchtime.renameWatchtimeUser, [channel, newName, oldName]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * @typedef old_watchtime
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
            await (async (users) => {
                await client.query("BEGIN");
                const usernames = users.map((u) => u.user);
                await client.query(statements.watchtime.watchtimeNew, [channel, usernames, month]).catch((e) => {
                    throw e;
                });
                for (const user of users) {
                    await client
                        .query(statements.watchtime.watchtimeIncBy, [user.user, channel, month, user.watchtime])
                        .catch((e) => {
                            throw e;
                        });
                }
                return await client.query("COMMIT").catch((e) => {
                    throw e;
                });
            })(chatters);
        } catch (e) {
            logger.error(e);
        } finally {
            client.release();
        }
    }
    /**
     * get a top list of watchtime
     * @param {string} channel Twitch Channel Name
     * @param {string | number} month
     * @param {number} max Amount of Viewers to fetch
     * @param {number} page
     * @returns {Promise<watchtimeuser[]>} Sorted Watchtime List
     */
    async watchtimeList(channel, month, max, page = 1) {
        channel = channel.replace(/#+/g, "");
        if (!(typeof max == "number")) throw new TypeError("You have to select how many entries you need as a number.");
        if (!(typeof page == "number")) throw new TypeError("You need to supply a number as page");
        const data = await this.db
            .query(statements.watchtime.watchtimeList, [month, channel, max, (page - 1) * max])
            .catch((e) => {
                logger.error(e);
            });
        if (!data) return null;
        return data.rows;
    }
    /**
     * get Watchtime for User on Channel
     * @param {string} channel
     * @param {string} user
     * @param {string} [month]
     * @returns {Promise<?number>} watchtime of the user
     */
    async getWatchtime(channel, user, month = "alltime") {
        channel = channel.replace("#", "");
        const data = await this.db.query(statements.watchtime.getWatchtime, [user, channel, month]).catch((e) => {
            logger.error(e);
        });
        if (!data) return null;
        return data.rows.length > 0 ? data.rows[0].watchtime : undefined;
    }
    // #endregion watchtime
    /**
     * get linked twitch account if exists, otherwise returns null
     * @param {import("discord.js").User} user discord user
     * @returns {Promise<string | null>} twitch username
     */
    async getDiscordConnection(user) {
        const data = await this.db.query(statements.userlink.getDiscordConnection, [user.id]).catch((e) => {
            logger.error(e);
        });
        if (!data) return null;
        return data?.rows?.length > 0 ? data.rows[0].twitchname : null;
    }
    /**
     * Set a twitch user to your discord user
     * @param {import("discord.js").User} user discord user
     * @param {string} twitchname twitch username
     */
    async newDiscordConnection(user, twitchname) {
        await this.db.query(statements.userlink.newDiscordConnection, [user.id, twitchname]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * @param  {import("discord.js").User} user
     */
    async deleteDiscordConnection(user) {
        try {
            await this.db.query(statements.userlink.deleteDiscordConnection, [user.id]);
        } catch (e) {
            logger.error(e);
        }
    }
    // #region blacklist
    /**
     * @param {string} channel
     * @param {string} word
     * @param {number} action
     */
    async newBlacklistWord(channel, word, action) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.blacklist.newBlacklistEntry, [channel, word, action]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * @param  {string} channel
     * @param  {string[]} words
     * @param  {number} action
     */
    async newBlacklistWords(channel, words, action) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.blacklist.newBlacklistEntries, [channel, words, action]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * @param  {string} channel
     * @param  {string} word
     */
    async removeBlacklistWord(channel, word) {
        try {
            channel = channel.replace(/#+/g, "");
            await this.db.query(statements.blacklist.removeBlacklistEntry, [channel, word]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * loads the blacklist into the client
     */
    async loadBlacklist() {
        try {
            const data = await this.db.query(statements.blacklist.loadBlacklist);
            if (!data) return;
            this.clients.twitch.blacklist = _.groupBy(data.rows, "channel");
        } catch (e) {
            logger.error(e);
        }
    }
    // #endregion
    // #region commands
    /**
     * @param {string} channel
     * @param {string} command
     * @returns {Promise<import("../typings/dbtypes.js").Command|null>} the command if it exists in the database
     */
    async resolveCommand(channel, command) {
        try {
            channel = channel.replace(/#+/, "");
            /** @type {import("pg").QueryResult<import("../typings/dbtypes.js").Command>} */
            const data = await this.db.query(statements.commands.resolveCommand, [channel, command]);
            return data?.rows[0] ?? null;
        } catch (e) {
            logger.error(e);
            return null;
        }
    }
    /**
     * @param {string} channel
     * @param {string} command
     * @param {boolean} enabled
     */
    async updateCommandEnabled(channel, command, enabled) {
        channel = channel.replace(/#+/, "");
        await this.db.query(statements.commands.updateCommandEnabled, [enabled, channel, command]).catch((e) => {
            logger.error(e);
        });
    }
    /**
     * @param {string} channel
     * @param {string} command
     * @param {number} permission
     */
    async updateCommandPermission(channel, command, permission) {
        channel = channel.replace(/#+/, "");
        try {
            await this.db.query(statements.commands.updateCommandPermission, [permission, channel, command]);
        } catch (e) {
            logger.error(e);
        }
    }
    /**
     * @param {string} channel
     * @param {string} command
     * @param {boolean} enabled
     * @param {number} permission
     */
    async newCommand(channel, command, enabled, permission) {
        channel = channel.replace(/#+/, "");
        try {
            await this.db.query(statements.commands.newCommand, [channel, command, enabled, permission]);
        } catch (e) {
            logger.error(e);
        }
    }
    // #endregion commands
}
