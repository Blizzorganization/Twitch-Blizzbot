global.util = require("util");
global.fs = require("fs");
/**
 * @param {import("../../modules/clients").Clients} clients
 * @param {string[]} args
 */
exports.run = (clients, args) => {
    const evaled = eval(args.join(" "));
    clients.logger.log("info", global.util.inspect(evaled));
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    const completions = Object.keys(global).filter(i => !i.startsWith("_"));
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
};