import loadSlash from "../../modules/slashsetup.js";
/**
 * @name loadSlash
 * @namespace ConsoleCommands
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 */
export function run(clients) {
    loadSlash(clients.discord, clients.discord.commandchannel.guild.id);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(clients, line) {
    return [["loadslash"], line];
}
