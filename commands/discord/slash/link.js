module.exports = {
    data: {
        name: "link",
        description: "Verknüpfe deinen Twitch Account mit deinem Discord Account",
        type: 1,
        options: [{
            type: 3,
            name: "name",
            description: "Twitch Username",
            required: true
        }]
    },
    /**
     * @param  {import("discord.js").CommandInteraction} interaction
     */
    execute: async (interaction) => {
        /** @type {import("../../../modules/discordclient").DiscordClient}*/
        // @ts-ignore
        let client = interaction.client;
        let name = interaction.options.getString("name").toLowerCase();
        let previous = await client.clients.db.getDiscordConnection(interaction.user);
        await client.clients.db.newDiscordConnection(interaction.user, name);
        await interaction.reply(previous == null || previous == undefined ? `Der Name **${name.toLowerCase()}** wurde erfolgreich eingetragen` : `Du hast deinen Namen von **${previous}** auf **${name.toLowerCase()}** geändert.`);
    }
};