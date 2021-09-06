const { TextChannel } = require("discord.js");
const { CustomError } = require("../../modules/CustomError");

/**
 * 
 * @param {import("../../modules/discordclient").DiscordClient} client 
 */
exports.event = (client) => {
    client.clients.logger.log("info", "Discord connected.");
    var blchannel = client.channels.resolve(client.config.channels.blacklist);
    if (!blchannel) throw new CustomError("UnknownChannelError", "Discord Blacklist Channel ID could not be resolved.");
    if (blchannel instanceof TextChannel) {
        client.blchannel = blchannel;
    } else throw new CustomError("ChanneltypeError", "The Blacklist channel ID supplied in the config.json file does not belong to a text channel.");
    var commandchannel = client.channels.resolve(client.config.channels.adminCommands);
    if (!commandchannel) throw new CustomError("UnknownChannelError", "Discord Status Channel Channel ID could not be resolved.");
    if (commandchannel instanceof TextChannel) {
        client.commandchannel = commandchannel;
    } else throw new CustomError("ChanneltypeError", "The Command Channel ID supplied in the config.json file does not belong to a text channel.");
    var relaychannel = client.channels.resolve(client.config.channels.relay);
    if (!relaychannel) throw new CustomError("UnknownChannelError", "Discord Relay Channel Channel ID could not be resolved.");
    if (relaychannel instanceof TextChannel) {
        client.relaychannel = relaychannel;
    } else throw new CustomError("ChanneltypeError", "The Command Channel ID supplied in the config.json file does not belong to a text channel.");
    client.started = true;
    client.clients.db.newDiscordConnection(client.user, client.clients.twitch.config.identity.username);
};