exports.Clients = class Clients extends Map {
    discord;
    twitch;
    console;
    constructor() {
        super()
    }
    /**
     * stops all Clients supplied
     */
    async stop() {
        console.log("stopping")
        var stopping = []
        stopping.push(this.twitch.stop())
        stopping.push(this.console.stop())
        if (this.discord) stopping.push(this.discord.stop())
        var stopped = await Promise.all(stopping)
        console.log("Goodbye")
        process.exit(0)
        return stopped
    }
}