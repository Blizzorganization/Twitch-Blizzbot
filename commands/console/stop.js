/**
 * @name stop
 * @namespace ConsoleCommands
 * @param {import("../../modules/clients").Clients} clients
 */
exports.run = async (clients) => {
    await clients.stop();
    process.exit(0);
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    return [["stop"], line];
};