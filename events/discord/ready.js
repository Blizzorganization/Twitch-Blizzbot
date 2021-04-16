const { TextChannel } = require("discord.js")
const { CustomError } = require("../../modules/CustomError")

exports.event = (client) => {
    console.log("Discord connected.")
    var blchannel = client.channels.resolve(client.config.channels.blacklist)
    if (!blchannel) throw new CustomError("UnknownChannelError", "Discord Blacklist Channel ID could not be resolved.")
    if (blchannel instanceof TextChannel) {
        client.blchannel = blchannel
    } else throw new CustomError("ChanneltypeError", "The Blacklist channel ID supplied in the config.json file does not belong to a text channel.")
    var statuschannel = client.channels.resolve(client.config.channels.status)
    if (!statuschannel) throw new CustomError("UnknownChannelError", "Discord Status Channel Channel ID could not be resolved.")
    if (statuschannel instanceof TextChannel) {
        client.statuschannel = statuschannel
    } else throw new CustomError("ChanneltypeError", "The Status Channel ID supplied in the config.json file does not belong to a text channel.")
    if (client.clients.twitch.started && !client.started) client.statuschannel.send("Bot wurde gestartet.")
    client.started = true
}