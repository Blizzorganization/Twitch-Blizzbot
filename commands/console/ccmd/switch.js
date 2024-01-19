/* eslint-disable no-sparse-arrays */
import { logger } from "twitch-blizzbot/logger";

/**
 * @name switch
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(clients, args) {
    if (!args || args.length < 2) {
        logger.warn("Du musst einen Kanal und einen Befehl angeben.");
        return;
    }
    const channel = args.shift().toLowerCase();
    let cmdName = args.shift().toLowerCase();
    if (cmdName.startsWith("!")) cmdName = cmdName.slice(1);
    const cmd = clients.twitch.commands.get(cmdName);
    if (!cmd) {
        logger.warn("Diesen Befehl gibt es nicht.");
        return;
    }
    const dbCmd = await clients.db.resolveCommand(channel, cmdName);
    if (dbCmd) {
        await clients.db.updateCommandEnabled(channel, cmdName, !dbCmd.enabled);
        logger.info(`Der Befehl !${cmdName} ist jetzt ${dbCmd.enabled ? "ausgeschaltet" : "eingeschaltet"}.`);
        return;
    }
    await clients.db.newCommand(channel, cmdName, false, -1);
    logger.info(`Der Befehl !${cmdName} ist jetzt deaktiviert.`);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(clients, line) {
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
