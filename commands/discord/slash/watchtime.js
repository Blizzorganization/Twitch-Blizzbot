const { MessageEmbed } = require("discord.js");
const { calcWatchtime } = require("../../../modules/functions");

module.exports = {
    data: {
        name: "watchtime",
        description: "Watchtime",
        type: 1,
        options: [{
            type: 6,
            name: "user",
            description: "Ein Nutzer, wenn nicht du gemeint sein sollst",
            required: false,
        },
        {
            type: 3,
            name: "twitchuser",
            description: "Twitch Username eines Nutzers",
            required: false,
        }],
    },
    execute: async (interaction) => {
        /** @type {import("../../../modules/discordclient").DiscordClient}*/
        const client = interaction.client;
        const channel = client.config.watchtimechannel;
        const dcuser = interaction.options.getUser("user") || interaction.user;
        const twuser = interaction.options.getString("twitchuser") || await client.clients.db.getDiscordConnection(dcuser);
        if (!twuser) {
            return interaction.reply("Du musst dich zuerst registrieren - /link");
        }
        const watchtime = await client.clients.db.getWatchtime(channel, twuser, "alltime");
        const maxWatchtime = await client.clients.db.getWatchtime(channel, client.clients.twitch.getUsername(), "alltime");
        const embed = new MessageEmbed()
            .setColor(0xedbc5d)
            .setThumbnail(client.user.avatarURL({ format: "png" }))
            .setTitle("Watchtime")
            .addField("Nutzername", twuser)
            .addField("Watchtime", `${calcWatchtime(watchtime)}`)
            .addField("Von der gestreamten Zeit", `${Math.round(1000 * watchtime / maxWatchtime) / 10}%`)
        await interaction.reply({ embeds: [embed] });
    },
};