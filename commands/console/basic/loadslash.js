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
 * @param  {import("twitch-blizzbot/clients").Clients} _clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(_clients, line) {
    return [["loadslash"], line];
}
