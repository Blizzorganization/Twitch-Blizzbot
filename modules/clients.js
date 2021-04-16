exports.Clients = class Clients extends Map {
    discord;
    twitch;
    console;
    constructor() {
        super()
    }
    async stop() {
        console.log("stopping")
        var stopped = await Promise.all([this.twitch.stop(), this.console.stop(), this.discord.stop()])
        console.log("Goodbye")
        process.exit(0)
        return stopped
    }
}