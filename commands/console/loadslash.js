import loadSlash from "../../modules/slashsetup.js";
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 */
export function run(clients) {
    loadSlash(clients.discord, clients.discord.commandchannel.guild.id);
}
/**
 * @name loadSlash
 * @namespace ConsoleCommands
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
export function completer(clients, line) {
    return [["loadslash"], line];
}
