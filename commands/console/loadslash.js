const loadSlash = require("../../modules/slashsetup.js");
/**
 * @param  {import("../../modules/clients").Clients} clients
 */
exports.run = (clients) => {
    loadSlash(clients.discord, clients.discord.commandchannel.guild.id);
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    return [["loadslash"], line];
};