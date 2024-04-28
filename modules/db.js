import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import _ from "lodash";
import pg from "pg";
import { permissions } from "./constants.js";
import { aliases } from "./db/schema/aliases.js";
import { blacklist } from "./db/schema/blacklist.js";
import { commands } from "./db/schema/commands.js";
import { counters } from "./db/schema/counters.js";
import { customcommands } from "./db/schema/customcommands.js";
import { streamers } from "./db/schema/streamer.js";
import { userlink } from "./db/schema/userlink.js";
import { watchtime } from "./db/schema/watchtime.js";
import { currentMonth } from "./functions.js";
import { logger } from "./logger.js";
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
    #doingWatchtime = false;
    /**
     * @param {import("../typings/dbtypes.js").Config} config
     */
    constructor(config) {
        this.db = new Pool(config);
        this.dbname = config.database;
        /** @type {import("./clients.js").Clients}*/
        this.clients = undefined;
        this.ensureTables().catch((e) => {
            logger.error("Failed to ensure tables: ", e);
        });
        this.drizzle = drizzle(this.db, {
            logger: {
                logQuery(query, params) {
                    logger.debug(
                        `[DB] Executing query ${query} with params ${new Intl.ListFormat().format(params.map((p) => `${p}`))}`,
                    );
                },
            },
        });
    }
    /**
     * initializes the Database
     */
    async ensureTables() {
        await this.drizzle.transaction(async (tx) => {
            const tables = (
                await tx.execute(
                    sql`SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';`,
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
                await tx.query(sql.raw(stmt[1]));
            }
        });
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
        channel = channel.replace(/#+/g, "");
        await this.drizzle.insert(streamers).values({ name: channel, automessage: true });
    }
    /**
     * retrieve a new channel from the database
     * @param {string} channel
     * @returns {Promise<streamers["$inferSelect"]|null>} the config of the channel
     */
    async getChannel(channel) {
        const data = await this.drizzle.select().from(streamers).where(eq(streamers.name, channel));
        if (!data) return null;
        return data.length == 0 ? null : data[0];
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
        await this.drizzle
            .insert(aliases)
            .values({
                channel,
                command,
                alias: name,
            })
            .onConflictDoNothing();
    }
    /**
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<import("../typings/dbtypes.js").ResolvedAlias|null>} command data
     */
    async resolveAlias(channel, name) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle
            .select({
                alias: aliases.alias,
                command: aliases.command,
                response: customcommands.response,
                permissions: customcommands.permissions,
            })
            .from(aliases)
            .leftJoin(
                customcommands,
                and(eq(aliases.command, customcommands.command), eq(aliases.channel, customcommands.channel)),
            )
            .where(and(eq(aliases.alias, name), eq(aliases.channel, channel)));
        return data[0] ?? null;
    }
    /**
     * find Alias
     * @param {string} channel Channel where to add the Alias
     * @param {string} command Command the alias refers to
     * @returns {Promise<string[]>} string returns
     */
    async findRelatedAliases(channel, command) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle
            .select({ alias: aliases.alias })
            .from(aliases)
            .where(and(eq(aliases.channel, channel), eq(aliases.command, command)));
        // @ts-expect-error -- this would be the necessary null check
        return data.map((row) => row.alias).filter((v) => v !== null);
    }
    /**
     * delete an alias
     * @param {string} channel
     * @param {string} name Name of the Alias to delete
     */
    async deleteAlias(channel, name) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle.delete(aliases).where(and(eq(aliases.channel, channel), eq(aliases.alias, name)));
    }
    /**
     * Get all existing aliases
     * @param {string} channel
     * @returns {Promise<aliases["$inferSelect"][]>} List of all Aliases
     */
    async getAliases(channel) {
        channel = channel.replace(/#+/g, "");
        return await this.drizzle.select().from(aliases).where(eq(aliases.channel, channel));
    }
    // #endregion aliases

    // #region counters
    /**
     * creates a new counter
     * @param  {string} channel channel to create the counter for
     * @param  {string} name counter name
     * @param {number} [inc] the automatic increase
     * @param {number} [defaultVal] the starting value
     */
    async newCounter(channel, name, inc = 1, defaultVal = 0) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle.insert(counters).values({ channel, cur: defaultVal, inc, name });
    }
    /**
     * read only, does NOT modify the value
     * @param {string} channel
     * @param {string} name
     * @returns {Promise<number|null>} value if exists
     */
    async readCounter(channel, name) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle
            .select({ cur: counters.cur })
            .from(counters)
            .where(and(eq(counters.name, name), eq(counters.channel, channel)));
        return data[0]?.cur ?? null;
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @returns {Promise<number|null>} the counter value
     */
    async getCounter(channel, name) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle
            .update(counters)
            .set({ cur: sql`${counters.cur} + ${counters.inc}` })
            .where(and(eq(counters.channel, channel), eq(counters.name, name)))
            .returning({ cur: counters.cur });
        return data[0]?.cur;
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @param  {number} val
     */
    async setCounter(channel, name, val) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle
            .update(counters)
            .set({ cur: val })
            .where(and(eq(counters.channel, channel), eq(counters.name, name)));
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     * @param  {number} inc
     */
    async editCounter(channel, name, inc) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle
            .update(counters)
            .set({ inc })
            .where(and(eq(counters.channel, channel), eq(counters.name, name)));
    }
    /**
     * @param  {string} channel
     * @param  {string} name
     */
    async delCounter(channel, name) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle.delete(counters).where(and(eq(counters.channel, channel), eq(counters.name, name)));
    }
    /**
     * @param  {string} channel
     * @returns {Promise<counters["$inferSelect"][]>} a list of counters
     */
    async allCounters(channel) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle.select().from(counters).where(eq(counters.channel, channel));
        return data;
    }
    // #endregion counters

    // #region Customcommands
    /**
     * get all customcommands
     * @param {string} channel
     * @param {number} permission
     * @returns {Promise<string[]|null>} list of customcommands
     */
    async allCcmds(channel, permission = permissions.user) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle
            .select({ command: customcommands.command })
            .from(customcommands)
            .where(and(eq(customcommands.channel, channel), eq(customcommands.permissions, permission)));
        if (!data) return null;
        return data.map((row) => row.command);
    }
    /**
     * get response of customcommand
     * @param {string} channel
     * @param {string} commandname
     * @returns {Promise<customcommands["$inferSelect"]|null>} response
     */
    async getCcmd(channel, commandname) {
        channel = channel.replace(/#+/g, "");
        const data = await this.drizzle
            .select()
            .from(customcommands)
            .where(and(eq(customcommands.channel, channel), eq(customcommands.command, commandname)));
        return data.length > 0 ? data[0] : null;
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
        await this.drizzle
            .insert(customcommands)
            .values({
                channel,
                command: commandname,
                permissions: perms,
                response,
            })
            .onConflictDoNothing();
    }
    /**
     * @param  {import("../typings/dbtypes.js").CustomCommand[]} cmdData
     * @param  {string} channel
     * @param  {"user"|"mod"} cmdType
     */
    async migrateCustomcommands(cmdData, channel, cmdType) {
        channel = channel.replace(/#+/, "");
        await this.drizzle.transaction(async (tx) => {
            await (async (cmds) => {
                for (const cmd of cmds) {
                    await tx
                        .insert(customcommands)
                        .values({
                            channel,
                            command: cmd.command,
                            permissions: permissions[cmdType],
                            response: cmd.response,
                        })
                        .onConflictDoNothing();
                }
            })(cmdData);
        });
    }
    /**
     * Edit a Customcommand/change its response
     * @param {string} channel
     * @param {string} commandname
     * @param {string} response
     */
    async editCcmd(channel, commandname, response) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle
            .update(customcommands)
            .set({ response })
            .where(and(eq(customcommands.command, commandname), eq(customcommands.channel, channel)));
    }
    /**
     * Edit a Customcommand/change its name
     * @param {string} channel
     * @param {string} commandname
     * @param {string} newName
     */
    async renameCCmd(channel, commandname, newName) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle
            .update(customcommands)
            .set({ command: newName })
            .where(and(eq(customcommands.channel, channel), eq(customcommands.command, commandname)));
    }
    /**
     * delete a Customcommand
     * @param {string} channel
     * @param {string} commandname
     */
    async delCcmd(channel, commandname) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle
            .delete(customcommands)
            .where(and(eq(customcommands.command, commandname), eq(customcommands.channel, channel)));
    }
    /**
     * transfers a customcommande to another permission level
     * @param  {string} channel
     * @param  {string} commandname
     * @returns {Promise<"no_such_command"|"ok">}
     */
    async transferCmd(channel, commandname) {
        const data = await this.drizzle
            .select({ permissions: customcommands.permissions })
            .from(customcommands)
            .where(and(eq(customcommands.command, commandname), eq(customcommands.channel, channel)));
        if (data.length === 0) return "no_such_command";
        const newPerm = data[0].permissions === permissions.user ? permissions.mod : permissions.user;
        await this.drizzle
            .update(customcommands)
            .set({ permissions: newPerm })
            .where(and(eq(customcommands.command, commandname), eq(customcommands.channel, channel)));
        return "ok";
    }
    // #endregion Customcommands

    // #region watchtime
    /**
     * Default Watchtime Increase (and creation for new users)
     * @param {string} channel Channel where to add Watchtime
     * @param {string[]} chatters List of Users to add Watchtime to
     */
    async watchtime(channel, chatters) {
        if (this.#doingWatchtime) {
            logger.warn(`watchtime already in progress at ${new Date().toLocaleTimeString()}`);
            return;
        }
        this.#doingWatchtime = true;
        await this.drizzle.transaction(async (tx) => {
            const started = new Date();
            logger.debug(`starting watchtime at ${started.toLocaleTimeString()}`);
            channel = channel.replace(/#+/, "");
            const month = currentMonth();
            await tx
                .insert(watchtime)
                .values(chatters.map((viewer) => ({ channel, month, viewer, watchtime: 0 })))
                .onConflictDoNothing();
            await tx
                .insert(watchtime)
                .values(chatters.map((viewer) => ({ channel, month: "alltime", viewer, watchtime: 0 })))
                .onConflictDoNothing();
            await tx
                .update(watchtime)
                .set({ watchtime: sql`${watchtime.watchtime} + 1` })
                .where(and(inArray(watchtime.viewer, chatters), inArray(watchtime.month, [month, "alltime"])));
            const endtime = new Date();
            logger.debug(
                `finished watchtime at ${endtime.toLocaleTimeString()}
                Took ${endtime.getTime() - started.getTime()}ms.`,
            );
        });
        this.#doingWatchtime = false;
    }
    /**
     * rename a watchtime user
     * @param {string} channel Channel where to rename the viewer
     * @param {string} oldName previous name of the viewer
     * @param {string} newName new name to change to
     */
    async renameWatchtimeUser(channel, oldName, newName) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle
            .update(watchtime)
            .set({ viewer: newName })
            .where(and(eq(watchtime.channel, channel), eq(watchtime.viewer, oldName)));
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
        channel = channel.replace(/#+/, "");
        await this.drizzle.transaction(async (tx) => {
            await (async (users) => {
                const usernames = users.map((u) => u.user);
                await tx
                    .insert(watchtime)
                    .values(usernames.map((username) => ({ channel, month, viewer: username, watchtime: 0 })))
                    .onConflictDoNothing();
                for (const user of users) {
                    await tx
                        .update(watchtime)
                        .set({ watchtime: sql`${watchtime.watchtime} + ${user.watchtime}` })
                        .where(
                            and(
                                eq(watchtime.viewer, user.user),
                                eq(watchtime.channel, channel),
                                eq(watchtime.month, month),
                            ),
                        );
                }
            })(chatters);
        });
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
        const data = await this.drizzle
            .select({ viewer: watchtime.viewer, watchtime: watchtime.watchtime })
            .from(watchtime)
            .where(and(eq(watchtime.month, month.toString()), eq(watchtime.channel, channel)))
            .orderBy((ob) => ob.watchtime)
            .limit(max)
            .offset((page - 1) * max);
        return data.map(({ viewer, watchtime: wt }) => ({ viewer, watchtime: wt ?? 0 }));
    }
    /**
     * get Watchtime for User on Channel
     * @param {string} channel
     * @param {string} user
     * @param {string} [month]
     * @returns {Promise<number|null>} watchtime of the user
     */
    async getWatchtime(channel, user, month = "alltime") {
        channel = channel.replace("#", "");
        const data = await this.drizzle
            .select({ watchtime: watchtime.watchtime })
            .from(watchtime)
            .where(and(eq(watchtime.viewer, user), eq(watchtime.channel, channel), eq(watchtime.month, month)));
        return data.length > 0 ? data[0].watchtime : null;
    }
    // #endregion watchtime
    /**
     * get linked twitch account if exists, otherwise returns null
     * @param {import("discord.js").User} user discord user
     * @returns {Promise<string | null>} twitch username
     */
    async getDiscordConnection(user) {
        const data = await this.drizzle.select().from(userlink).where(eq(userlink.discordid, user.id));
        return data.length > 0 ? data[0].twitchname : null;
    }
    /**
     * Set a twitch user to your discord user
     * @param {import("discord.js").User} user discord user
     * @param {string} twitchname twitch username
     */
    async newDiscordConnection(user, twitchname) {
        await this.drizzle.insert(userlink).values({ discordid: user.id, twitchname });
    }
    /**
     * @param  {import("discord.js").User} user
     */
    async deleteDiscordConnection(user) {
        await this.drizzle.delete(userlink).where(eq(userlink.discordid, user.id));
    }
    // #region blacklist
    /**
     * @param {string} channel
     * @param {string} word
     * @param {number} action
     */
    async newBlacklistWord(channel, word, action) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle.insert(blacklist).values({ action, blword: word, channel }).onConflictDoNothing();
    }
    /**
     * @param  {string} channel
     * @param  {string[]} words
     * @param  {number} action
     */
    async newBlacklistWords(channel, words, action) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle.insert(blacklist).values(words.map((blword) => ({ blword, action, channel })));
    }
    /**
     * @param  {string} channel
     * @param  {string} word
     */
    async removeBlacklistWord(channel, word) {
        channel = channel.replace(/#+/g, "");
        await this.drizzle.delete(blacklist).where(and(eq(blacklist.channel, channel), eq(blacklist.blword, word)));
    }
    /**
     * loads the blacklist into the client
     */
    async loadBlacklist() {
        const data = await this.drizzle.select().from(blacklist);
        this.clients.twitch.blacklist = _.groupBy(data, "channel");
    }
    // #endregion
    // #region commands
    /**
     * @param {string} channel
     * @param {string} command
     * @returns {Promise<commands["$inferSelect"]|null>} the command if it exists in the database
     */
    async resolveCommand(channel, command) {
        channel = channel.replace(/#+/, "");
        const [data] = await this.drizzle
            .select()
            .from(commands)
            .where(and(eq(commands.channel, channel), eq(commands.command, command)));
        return data ?? null;
    }
    /**
     * @param {string} channel
     * @param {string} command
     * @param {boolean} enabled
     */
    async updateCommandEnabled(channel, command, enabled) {
        channel = channel.replace(/#+/, "");
        await this.drizzle
            .update(commands)
            .set({ enabled })
            .where(and(eq(commands.channel, channel), eq(commands.command, command)));
    }
    /**
     * @param {string} channel
     * @param {string} command
     * @param {number} permission
     */
    async updateCommandPermission(channel, command, permission) {
        channel = channel.replace(/#+/, "");
        await this.drizzle
            .update(commands)
            .set({ permission })
            .where(and(eq(commands.channel, channel), eq(commands.command, command)));
    }
    /**
     * @param {string} channel
     * @param {string} command
     * @param {boolean} enabled
     * @param {number} permission
     */
    async newCommand(channel, command, enabled, permission) {
        channel = channel.replace(/#+/, "");
        await this.drizzle.insert(commands).values({ command, channel, enabled, permission }).onConflictDoNothing();
    }
    // #endregion commands
}
