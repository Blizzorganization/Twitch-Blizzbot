module.exports = {
    data: {
        name: "unlink",
        description: "Entferne die Verknüpfung zu deinem Twitch Account",
        type: 1
    },
    /**
     * @param  {import("discord.js").CommandInteraction} interaction
     */
    execute: async (interaction) => {
        /** @type {import("../../../modules/discordclient").DiscordClient}*/
        // @ts-ignore
        let client = interaction.client;
        let previous = await client.clients.db.getDiscordConnection(interaction.user);
        if (!previous) return interaction.reply("Du hast keinen Twitchnamen hinterlegt, den ich löschen kann.");
        await client.clients.db.deleteDiscordConnection(interaction.user);
        await interaction.reply(`Deine Verknüpfung zu **${previous}** wurde gelöscht.`);
    }
};