const { MessageEmbed } = require("discord.js");

module.exports = {
    data: {
        name: "twitchname",
        description: "Frage einen twitch username ab",
        type: 1,
        options: [{
            type: 6,
            name: "user",
            description: "Ein Nutzer, wenn nicht du gemeint sein sollst",
            required: false
        }]
    },
    
    execute: async (interaction) => {
        /** @type {import("../../../modules/discordclient").DiscordClient}*/
        let client = interaction.client;
        let dcuser = interaction.options.getUser("user") || interaction.user;
        let twuser = await client.clients.db.getDiscordConnection(dcuser);
        if (!twuser) return interaction.reply(`Der Nutzer ${dcuser.tag} hat keinen Namen hinterlegt.`);
        var embed = new MessageEmbed()
            .setColor(0xdfb82d)
            .setThumbnail(dcuser.avatarURL())
            .setTitle("**__Linkinginfo__**")
            .addField("Discord-name", dcuser.username)
            .addField("Twitch-name", twuser);

        await interaction.reply({ embeds: [embed] });
    }
};