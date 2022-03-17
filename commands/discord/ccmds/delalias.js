exports.adminOnly = true;
/**
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
exports.run = async (client, message, args) => {
    const twchannel = client.config.watchtimechannel;
    if (args.length == 0) return;
    await client.clients.db.deleteAlias(twchannel, args[0]);
    message.reply({ content: `Der Alias ${args[0]} wurde entfernt.` });
    client.clients.logger.log("command", `* Deleted alias ${args[0]}`);
};