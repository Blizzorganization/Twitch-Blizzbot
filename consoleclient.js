const { Collection } = require("discord.js");
const EventEmitter = require("events");
const { existsSync, readdir } = require("fs");
const { createInterface } = require("readline");
const { CustomError } = require("./CustomError");

exports.ConsoleClient = class ConsoleClient extends EventEmitter {
    rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "" })
    clients;
    commands = new Collection();
    constructor() {
        super()
        this.loadCommands(this.commands, "commands/console")
        this.rl.write("Listening to Console Commands\n")
        this.rl.on("line", (line) => this.online(line))
        this.rl.on("SIGINT", () => this.clients.stop())
        this.rl.on("SIGCONT", () => this.clients.stop())
        this.rl.on("SIGTSTP", () => this.clients.stop())
        this.rl.on("close", console.log)
    }
    write = this.rl.write
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
    loadCommands(commandmap, commanddir, helplist) {
        var readcommanddir = "./" + commanddir
        if (existsSync(readcommanddir)) {
            readdir(`./${readcommanddir}/`, (err, files) => {
                if (err) return console.error(err);
                files.forEach(file => {
                    if (!(file.endsWith(".js") || file.endsWith(".ts"))) return;
                    let command = file.split(".")[0]
                    let props = require(`./${commanddir}/${command}`);
                    console.log(`Attempting to load Command ${command}`)
                    commandmap.set(command, props)
                    if (props.help && helplist) helplist.push(command)
                    if (!props.alias) return

                })
            })
        } else throw new CustomError("LoadError", `CommandDirectory ${commanddir} does not exist.`)
    }
    async stop() {
        return this.rl.close()
    }
}