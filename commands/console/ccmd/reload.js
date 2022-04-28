import { readFileSync } from "fs";
import { logger } from "twitch-blizzbot/logger";

/**
 * @name reload
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 */
export async function run(clients) {
    clients.twitch.messages = JSON.parse(readFileSync("configs/automessages.json", "utf8"));
    clients.twitch.permittedlinks = readFileSync("./configs/links.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/)
        .filter((link) => link !== "");
    clients.twitch.deletelinks = readFileSync("./configs/TLDs.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/)
        .filter((link) => link !== "");
    logger.debug(`Folgende Links sind jetzt erlaubt: ${clients.twitch.permittedlinks.join("\t")}`);
    logger.info("Alle Datein wurden erfolgreich neu eingelesen.");
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(clients, line) {
    return [["reload"], line];
}
