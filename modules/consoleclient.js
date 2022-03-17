import { Collection } from "discord.js";
import EventEmitter from "events";
import { createInterface } from "readline";
import { loadCommands } from "./functions.js";
import { logger } from "./logger.js";
/**
 * ConsoleClient Class
 * @class
 * @property {Interface} rl readline Instance
 * @property {Clients} clients Access to the other clients
 * @property {Collection} commands
 */
export class ConsoleClient extends EventEmitter {
    constructor() {
        super();
        /** @type {import("./clients").Clients} */
        this.clients = undefined;
        this.stopping = false;
        this.commands = new Collection;
        this.processStats = undefined;
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
        logger.log("verbose", "Listening to Console Commands");
        this.rl.on("line", (line) => this.online(line));
        this.rl.on("SIGINT", () => this.stopping ? null : this.clients.stop());
        this.rl.on("SIGCONT", () => this.stopping ? null : this.clients.stop());
        this.rl.on("SIGTSTP", () => this.stopping ? null : this.clients.stop());
        this.rl.on("close", () => this.stopping ? null : this.clients.stop());

        try {
            const pidu = require("pidusage");
            this.processStats = setInterval(() => pidu(process.pid, (err, data) => logger.verbose(`cpu: ${Math.round(data.cpu * 100) / 100}%; memory: ${Math.round(data.memory / 1024 / 1024 * 100) / 100}MB`)), 10000);
            pidu(process.pid, (err, data) => logger.log("verbose", `cpu: ${Math.round(data.cpu * 100) / 100}%; memory: ${Math.round(data.memory / 1024 / 1024 * 100) / 100}MB`));
        } catch (e) {
            logger.silly("Process metrics are not collected.");
        }
    }
    /**
     *
     * @param {string|Buffer} data
     * @param {import("readline").Key} key
     */
    write(data, key) {
        this.rl.write(data, key);
    }
    /**
     * method for parsing a line from readline
     * @param {string} line
     */
    online(line) {
        logger.log("stdin", line);
        const args = line.split(" ");
        const commandName = args.shift().toLowerCase();
        const cmd = this.commands.get(commandName);
        if (cmd) {
            cmd.run(this.clients, args);
        } else {
            logger.warn("Diese Funktion kenne ich nicht.");
        }
    }
    /**
     * stops the console client
     */
    async stop() {
        this.stopping = true;
        if (this.processStats) clearInterval(this.processStats);
        return this.rl.close();
    }
}