/* eslint-disable no-sparse-arrays */

import { logger } from "twitch-blizzbot/logger";

/**
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 */
export function run(clients, args) {
    let channel;
    if (clients.twitch.config.channels.length == 1) {
        channel = clients.twitch.config.channels[0];
    } else {
        channel = args.shift();
        if (!channel.startsWith("#")) return logger.error("No channel supplied, message will not be sent.");
    }
    clients.twitch.say(channel, args.join(" "));
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
export function completer(clients, line) {
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
}
