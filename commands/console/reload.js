const { readFileSync } = require("fs");
/**
 * @name reload
 * @namespace ConsoleCommands
 * @param {import("../../modules/clients").Clients} clients
 */
exports.run = async (clients) => {
    clients.twitch.messages = JSON.parse(readFileSync("automessages.json", "utf8"));
    clients.twitch.permittedlinks = readFileSync("./links.txt", "utf8").split(/\r\n|\n\r|\n|\r/).filter((link) => link !== "");
    clients.logger.debug("Folgende Links sind jetzt erlaubt: " + clients.twitch.permittedlinks.join("\t"));
    clients.logger.log("info", "Die automessages.json und links.txt wurden erfolgreich neu eingelesen.");
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    return [["reload"], line];
};