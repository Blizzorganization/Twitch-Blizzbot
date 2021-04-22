const {Clients} = require("../../modules/clients")

/**
 * @name stop
 * @module ConsoleCommands
 * @param {Clients} clients 
 * @param {string[]} args 
 */
exports.run = async (clients, args) => {
    await clients.stop()
    process.exit(0)
}