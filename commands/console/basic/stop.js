/**
 * @name stop
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 */
export async function run(clients) {
    await clients.stop();
    process.exit(0);
}
/**
 * @param  {import("twitch-blizzbot/clients").Clients} _clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(_clients, line) {
    return [["stop"], line];
}
