import fs from "fs";
import { getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";
import Util from "util";

global.util = Util;
global.fs = fs;
/**
 * @param {import("twitch-blizzbot/clients").Clients} clients
 */
export async function run(clients) {
    const query_size = `SELECT
    pg_size_pretty(pg_total_relation_size('watchtime')) as watchtime,
    pg_size_pretty(pg_total_relation_size('streamer')) as streamer,
    pg_size_pretty(pg_total_relation_size('customcommands')) as customcommands,
    pg_size_pretty(pg_total_relation_size('aliases')) as aliases,
    pg_size_pretty(pg_total_relation_size('counters')) as counters,
    pg_size_pretty(pg_total_relation_size('userlink')) as userlink,
    pg_size_pretty(pg_total_relation_size('blacklist')) as blacklist,
    pg_size_pretty( pg_database_size('${clients.db.dbname}') ) as total;`;
    const query_lines = `SELECT 'watchtime', count(*) from watchtime union
    SELECT 'streamer', count(*) from streamer union
    SELECT 'customcommands', count(*) from customcommands union
    SELECT 'aliases', count(*) from aliases union
    SELECT 'counters', count(*) from counters union
    SELECT 'userlink', count(*) from userlink union
    SELECT 'blacklist', count(*) from blacklist;`;
    const size = (await clients.db.db.query(query_size)).rows[0];
    const lines = [];
    const lines_data = (await clients.db.db.query(query_lines)).rows;
    lines_data.forEach((line) => {
        lines[line["?column?"]] = line.count;
    });
    lines["total"] = `${lines_data.reduce((a, b) => parseInt(a) + parseInt(b.count), 0)}`;
    logger.info(`\n${getTable({ size, lines })}`);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
export function completer(clients, line) {
    // eslint-disable-next-line no-sparse-arrays
    return [, line];
}
