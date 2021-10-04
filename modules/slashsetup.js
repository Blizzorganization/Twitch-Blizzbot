const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

module.exports = async function(client, guildid) {
    const commands = client.slashcommands.map(({ data }) => data);

    const rest = new REST({ version: "9" }).setToken(client.token);
    try {
        client.clients.logger.log("debug", "Started refreshing application (/) commands.");

        client.clients.logger.log("silly", await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildid),
            { body: commands },
        ));
        client.clients.logger.log("info", "Successfully reloaded application (/) commands.");
        client.clients.logger.log("debug", await rest.get(Routes.applicationGuildCommands(client.application.id || client.user.id, guildid)));
    } catch (error) {
        client.clients.logger.error(error.message);
    }
};