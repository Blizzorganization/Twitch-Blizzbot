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
    let completions = Object.keys(global).filter(i => !i.startsWith("_"));
    let args = line.split(" ");
    // eslint-disable-next-line no-sparse-arrays
    if (args.length > 2) return [, line];
    let cmd = args.shift();
    let fline = args.join(" ");
    let hits = completions.filter((c) => c.startsWith(fline));
    hits.forEach((val, key) => {
        hits[key] = `${cmd} ${val}`;
    });
    return [hits, line];
};