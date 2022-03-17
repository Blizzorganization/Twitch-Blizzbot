const util = require("util");
const functions = require("twitch-blizzbot/functions");
/**
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 */
exports.run = async (clients, args) => {
    const data = await clients.db.db.query(
        args.join(" "),
    ).catch(e => {
        if (e !== undefined) clients.logger.error(e);
    });
    if (!data) return clients.logger.error("Your query produced an error.");
    if (data.rows.length == 0) return clients.logger.warn("Your query didn't return any data.");
    data.rows.length == 1 ? clients.logger.info(
        util.inspect(data.rows[0], { colors: true }),
    ) : clients.logger.info(`\n${functions.getTable(data.rows)}`);
};
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    // eslint-disable-next-line no-sparse-arrays
    return [, line];
};