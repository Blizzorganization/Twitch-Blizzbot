import { inspect } from "util";
import { getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";

/**
 * @name dbquery
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(clients, args) {
    const data = await clients.db.db.query(args.join(" ")).catch((e) => {
        if (e !== undefined) logger.error(e);
    });
    if (!data) {
        logger.error("Your query produced an error.");
        return;
    }
    if (data.rows.length == 0) {
        logger.warn("Your query didn't return any data.");
        return;
    }
    data.rows.length == 1
        ? logger.info(inspect(data.rows[0], { colors: true }))
        : logger.info(`\n${getTable(data.rows)}`);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} _clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(_clients, line) {
    return [[], line];
}
