import fs from "fs";
import { logger } from "twitch-blizzbot/logger";
import Util from "util";

global.util = Util;
global.fs = fs;
/**
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 */
export function run(clients, args) {
    const evaled = eval(args.join(" "));
    logger.info(global.util.inspect(evaled));
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
export function completer(clients, line) {
    const completions = Object.keys(global).filter((i) => !i.startsWith("_"));
    const args = line.split(" ");
    // eslint-disable-next-line no-sparse-arrays
    if (args.length > 2) return [, line];
    const cmd = args.shift();
    const fline = args.join(" ");
    const hits = completions.filter((c) => c.startsWith(fline));
    hits.forEach((val, key) => {
        hits[key] = `${cmd} ${val}`;
    });
    return [hits, line];
}
