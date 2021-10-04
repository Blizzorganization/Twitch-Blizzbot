/**
 *
 * @param {import("../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Interaction} interaction
 */
exports.event = (client, interaction) => {
    if (!interaction.isCommand()) return;
    const commands = client.slashcommands;
    if (!commands.has(interaction.commandName)) return;
    try {
        commands.get(interaction.commandName).execute(interaction);
    } catch (e) {
        client.clients.logger.error(e);
        return interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
    }
};