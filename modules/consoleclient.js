const { Collection } = require("discord.js");
const EventEmitter = require("events");
const { loadCommands } = require("./functions");
const { createInterface } = require("readline");
/**
 * ConsoleClient Class
 * @class
 * @property {Interface} rl readline Instance
 * @property {Clients} clients Access to the other clients
 * @property {Collection} commands
 */
exports.ConsoleClient = class ConsoleClient extends EventEmitter {
    #processStats;
    constructor() {
        super();
        /** @type {import("./clients").Clients} */
        this.clients = undefined;
        this.stopping = false;
        this.commands = new Collection;
        this.#processStats = undefined;
        loadCommands(this.commands, "commands/console");
        const commands = this.commands;
        const cc = this;
        function completer(line) {
            const completions = commands.map((val, key) => key);
            const hits = completions.filter((c) => c.startsWith(line) || line.startsWith(c));
            if (line.startsWith(`${hits[0]} `)) {
                return commands.get(hits[0]).completer(cc.clients, line);
            }
            // Show all completions if none found
            return [hits.length ? hits : completions, line];
        }
        this.rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "", completer });
        require("./logger").log("verbose", "Listening to Console Commands");
        this.rl.on("line", (line) => this.online(line));
        this.rl.on("SIGINT", () => this.stopping ? null : this.clients.stop());
        this.rl.on("SIGCONT", () => this.stopping ? null : this.clients.stop());
        this.rl.on("SIGTSTP", () => this.stopping ? null : this.clients.stop());
        this.rl.on("close", () => this.stopping ? null : this.clients.stop());

        try {
            const pidu = require("pidusage");
            this.#processStats = setInterval(() => pidu(process.pid, (err, data) => require("./logger").log("verbose", `cpu: ${Math.round(data.cpu * 100) / 100}%; memory: ${Math.round(data.memory / 1024 / 1024 * 100) / 100}MB`)), 10000);
            pidu(process.pid, (err, data) => require("./logger").log("verbose", `cpu: ${Math.round(data.cpu * 100) / 100}%; memory: ${Math.round(data.memory / 1024 / 1024 * 100) / 100}MB`));
        } catch (e) {
            require("./logger").log("silly", "Process metrics are not collected.");
        }
    }
    /**
     *
     * @param {string|Buffer} data
     * @param [key]
     */
    write(data, key) {
        this.rl.write(data, key);
    }
    /**
     * method for parsing a line from readline
     * @param {string} line
     */
    online(line) {
        this.clients.logger.log("stdin", line);
        const args = line.split(" ");
        const commandName = args.shift().toLowerCase();
        const cmd = this.commands.get(commandName);
        if (cmd) {
            cmd.run(this.clients, args);
        } else {
            this.clients.logger.log("warn", "Diese Funktion kenne ich nicht.");
        }
    }
    /**
     * stops the console client
     */
    async stop() {
        this.stopping = true;
        if (this.#processStats) clearInterval(this.#processStats);
        return this.rl.close();
    }
};