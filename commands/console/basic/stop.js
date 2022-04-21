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
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 */
export function completer(clients, line) {
    return [["stop"], line];
}