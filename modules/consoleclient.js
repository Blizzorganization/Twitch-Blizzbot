import EventEmitter from "events";
import { createInterface } from "readline";
import { Collection } from "discord.js";
import { loadCommands } from "./functions.js";
import { logger } from "./logger.js";
/**
 * ConsoleClient Class
 * @class
 * @property {import("readline").Interface} rl readline Instance
 * @property {import("twitch-blizzbot/clients").Clients} clients Access to the other clients
 * @property {Collection} commands
 */
export class ConsoleClient extends EventEmitter {
    /**
     */
    constructor() {
        super();
        /** @type {import("./clients.js").Clients} */
        this.clients = undefined;
        this.stopping = false;
        this.commands = new Collection();
        this.processStats = undefined;
        loadCommands(this.commands, "commands/console/basic");
        loadCommands(this.commands, "commands/console/ccmd");
        const commands = this.commands;
        /**
         * @param {string} line
         * @returns {[string[], string]} the completion
         */
        function _completer(line) {
            const completions = commands.map((_val, key) => key);
            const hits = completions.filter((c) => c.startsWith(line) || line.startsWith(c));
            if (line.startsWith(`${hits[0]} `)) {
                return commands.get(hits[0]).completer(this.clients, line);
            }
            // Show all completions if none found
            return [hits.length ? hits : completions, line];
        }
        const completer = _completer.bind(this);
        this.rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "", completer });
        this.write = this.rl.write.bind(this.rl);
        logger.log("debug", "Listening to Console Commands");
        this.rl.on("line", (line) => this.online(line));
        this.rl.on("SIGINT", () => (this.stopping ? null : this.clients.stop()));
        this.rl.on("SIGCONT", () => (this.stopping ? null : this.clients.stop()));
        this.rl.on("SIGTSTP", () => (this.stopping ? null : this.clients.stop()));
        this.rl.on("close", () => (this.stopping ? null : this.clients.stop()));

        this.initProcessStats().catch(() => {
            logger.info("Process metrics are not collected.");
        });
    }
    /**
     *
     */
    async initProcessStats() {
        const { default: pidu } = await import("pidusage");
        this.processStats = setInterval(async () => {
            await this.collectMetrics(pidu);
        }, 10000);
        // biome-ignore lint/suspicious/noEmptyBlockStatements: this is allowed to fail.
        this.collectMetrics(pidu).catch(() => {});
    }

    /**
     *
     * @param {import("pidusage")} pidu
     * @returns {Promise<void>}
     */
    async collectMetrics(pidu) {
        const data = await pidu(process.pid).catch((err) => {
            logger.error("Failed to read pidusage: ", err);
        });
        if (!data) return;
        const cpuUsage = Math.round(data.cpu * 100) / 100;
        const memoryUsage = Math.round((data.memory / 1024 / 1024) * 100) / 100;
        logger.verbose(`cpu: ${cpuUsage}%; memory: ${memoryUsage}MB`);
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
        this.rl.close();
        return;
    }
}
