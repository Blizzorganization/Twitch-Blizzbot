exports.adminOnly = true;
/**
 * @name delbl
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
exports.run = async (client, message, args) => {
    if (!args || args.length == 0) return message.channel.send("Du musst angeben, was du von der Blacklist entfernen willst!");
    const blremove = args.join(" ").toLowerCase();
    if (!client.clients.twitch.blacklist[client.config.watchtimechannel].includes(blremove)) return message.channel.send(`"${blremove}" wird nicht gelöscht, kann also auch nicht aus der Blacklist entfernt werden.`);
    client.clients.twitch.blacklist[client.config.watchtimechannel] = client.clients.twitch.blacklist[client.config.watchtimechannel].filter((w) => w !== blremove);
    await client.clients.db.saveBlacklist();
    message.channel.send(`"${blremove}" wurde von der Blacklist von ${client.config.watchtimechannel} entfernt`);
    client.clients.logger.log("info", `* Removed "${blremove}" from Blacklist of ${client.config.watchtimechannel}`);
};