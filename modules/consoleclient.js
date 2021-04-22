const { Collection } = require("discord.js");
const EventEmitter = require("events");
const {loadCommands} = require("./functions")
const { createInterface } = require("readline");

/**
 * ConsoleClient Class
 * @class
 * @property {Interface} rl readline Instance
 * @property {Clients} clients Access to the other clients
 * @property {Collection} commands 
 */
exports.ConsoleClient = class ConsoleClient extends EventEmitter {
    rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "" })
    clients;
    commands = new Collection();
    constructor() {
        super()
        loadCommands(this.commands, "commands/console")
        this.rl.write("Listening to Console Commands\n")
        this.rl.on("line", (line) => this.online(line))
        this.rl.on("SIGINT", () => this.clients.stop())
        this.rl.on("SIGCONT", () => this.clients.stop())
        this.rl.on("SIGTSTP", () => this.clients.stop())
        this.rl.on("close", console.log)
    }
    /**
     * 
     * @param {string|Buffer} data 
     * @param {Key} [key] 
     */
    write(data, key) {
        this.rl.write(data, key)
    }
    /**
     * method for parsing a line from readline
     * @param {string} line 
     */
    online(line) {
        let args = line.split(" ")
        let commandName = args.shift().toLowerCase();
        let cmd = this.commands.get(commandName)
        if (cmd) {
            cmd.run(this.clients, args)
        } else {
            console.log("Diese Funktion kenne ich nicht.")
        }
    }
    /**
     * stops the console client
     */
    async stop() {
        return this.rl.close()
    }
}