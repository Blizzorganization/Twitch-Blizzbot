import loadSlash from "twitch-blizzbot/slashsetup";
/**
 * @name loadSlash
 * @namespace ConsoleCommands
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 */
export async function run(clients) {
    await loadSlash(clients.discord, clients.discord.commandchannel.guild.id);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(clients, line) {
    return [["loadslash"], line];
}
