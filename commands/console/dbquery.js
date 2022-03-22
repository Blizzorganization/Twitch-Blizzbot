import { getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";
import { inspect } from "util";
/**
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 */
export async function run(clients, args) {
    const data = await clients.db.db.query(args.join(" ")).catch((e) => {
        if (e !== undefined) logger.error(e);
    });
    if (!data) return logger.error("Your query produced an error.");
    if (data.rows.length == 0) return logger.warn("Your query didn't return any data.");
    data.rows.length == 1
        ? logger.info(inspect(data.rows[0], { colors: true }))
        : logger.info(`\n${getTable(data.rows)}`);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
export function completer(clients, line) {
    // eslint-disable-next-line no-sparse-arrays
    return [, line];
}
