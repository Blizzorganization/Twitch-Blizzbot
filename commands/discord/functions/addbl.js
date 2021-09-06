exports.adminOnly = true;
/**
 * @name addbl
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client 
 * @param {import("discord.js").Message} message 
 * @param {string[]} args 
 */
exports.run = async (client, message, args) => {
    if (!args || args.length == 0) return message.channel.send("Du musst angeben, was du blockieren willst!");
    let blword = args.join(" ").toLowerCase();
    client.clients.twitch.blacklist[client.config.watchtimechannel].push(blword);
    await client.clients.db.saveBlacklist();
    message.channel.send(`"${blword}" wurde in die Blacklist von ${client.config.watchtimechannel} eingetragen ;3`);
    client.clients.logger.log("info", `* Added "${blword}" to Blacklist of ${client.config.watchtimechannel}`);
};