module.exports = (clients, line) => {
    let args = line.split(" ")
    let commandName = args.shift().toLowerCase();
    let cmd = clients.console.commands.get(commandName)
    if (cmd) {
        cmd.run(clients, args)
    } else {
        console.log("Diese Funktion kenne ich nicht.")
    }
}