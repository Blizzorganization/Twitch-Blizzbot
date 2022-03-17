exports.adminOnly = false;
/**
 * @name unlink
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 */
exports.run = async (client, message) => {
    const name = await client.clients.db.getDiscordConnection(message.author);
    if (!name) return message.channel.send("Es existiert keine Twitch Verknüpfung, die ich löschen könnte.");
    await client.clients.db.deleteDiscordConnection(message.author);
    message.channel.send(`Deine Twitch Verknüpfung zu **${name}** wurde soeben gelöscht.`);
};
/**
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
