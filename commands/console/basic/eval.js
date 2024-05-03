import Util from "node:util";
import { logger } from "twitch-blizzbot/logger";
/**
 * @name eval
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} _clients
 * @param {string[]} args
 */
export function run(_clients, args) {
    const evaled = eval(args.join(" "));
    logger.info(Util.inspect(evaled));
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} _clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(_clients, line) {
    const completions = Object.keys(global).filter((i) => !i.startsWith("_"));
    const args = line.split(" ");
    if (args.length > 2) return [[], line];
    const cmd = args.shift();
    const fline = args.join(" ");
    const hits = completions.filter((c) => c.startsWith(fline));
    hits.forEach((val, key) => {
        hits[key] = `${cmd} ${val}`;
    });
    return [hits, line];
}
