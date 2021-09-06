const { getTable } = require("../../modules/functions");

global.util = require("util");
global.fs = require("fs");
/**
 * @param {import("../../modules/clients").Clients} clients 
 * @param {string[]} args 
 */
exports.run = async (clients) => {
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
    const size = (await clients.db.query(query_size)).rows[0];
    let lines = [];
    let lines_data = (await clients.db.query(query_lines)).rows;
    lines_data.forEach(line => { lines[line["?column?"]] = line.count; });
    lines["total"] = `${lines_data.reduce((a, b) => parseInt(a) + parseInt(b.count), 0)}`;
    clients.logger.log("info", "\n" + getTable({ size, lines }));
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    // eslint-disable-next-line no-sparse-arrays
    return [, line];
};