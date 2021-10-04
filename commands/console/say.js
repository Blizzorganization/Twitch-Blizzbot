/* eslint-disable no-sparse-arrays */
/**
 * @namespace ConsoleCommands
 * @param {import("../../modules/clients").Clients} clients
 * @param {string[]} args
 */
exports.run = (clients, args) => {
    let channel;
    if (clients.twitch.config.channels.length == 1) {
        channel = clients.twitch.config.channels[0];
    } else {
        channel = args.shift();
        if (!channel.startsWith("#")) return clients.logger.error("No channel supplied, message will not be sent.");
    }
    clients.twitch.say(channel, args.join(" "));
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    if (clients.twitch.config.channels.length == 1) return [, line];
    const args = line.split(" ");
    if (args.length > 2) return [, line];
    const cmd = args.shift();
    const completions = clients.twitch.config.channels;
    const fline = args.join(" ");
    const hits = completions.filter((c) => c.startsWith(fline));
    hits.forEach((val, key) => {
        hits[key] = `${cmd} ${val}`;
    });
    return [hits.length ? hits : completions, line];
};