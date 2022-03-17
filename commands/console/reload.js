const { readFileSync } = require("fs");
/**
 * @name reload
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 */
exports.run = async (clients) => {
    clients.twitch.messages = JSON.parse(readFileSync("configs/automessages.json", "utf8"));
    clients.twitch.permittedlinks = readFileSync("./configs/links.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/).filter((link) => link !== "");
    clients.twitch.deletelinks = readFileSync("./configs/TLDs.txt", "utf8")
        .split(/\r\n|\n\r|\n|\r/).filter((link) => link !== "");
    clients.logger.debug(`Folgende Links sind jetzt erlaubt: ${clients.twitch.permittedlinks.join("\t")}`);
    clients.logger.info("Alle Datein wurden erfolgreich neu eingelesen.");
};
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    return [["reload"], line];
};