const util = require("util");
const fs = require("fs");
const {Clients} = require("../../modules/clients")

/**
 * @name eval
 * @module ConsoleCommands
 * @param {Clients} clients 
 * @param {string[]} args 
 */
exports.run = (clients, args) => {
    console.log(eval(args.join(" ")))
}