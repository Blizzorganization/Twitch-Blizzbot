const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { calcWatchtime } = require("../../../modules/functions");


/**
 * @name watchtimelb
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 * @returns {Message|undefined}
 */
module.exports = {
    data: {
        name: "top10",
        description: "Watchtime Ranking",
        type: 1,
        options: [],
    },
    execute: async (interaction) => {
        /** @type {import("../../../modules/discordclient").DiscordClient}*/
        const client = interaction.client;
        const channel = client.config.watchtimechannel;
        const page = 1;
        const embed = new MessageEmbed()
            .setTitle("Watchtime")
            .setColor(0xdfb82d)
            .setDescription(channel)
            .setFooter("Seite " + page);
        const watchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
        for (const viewer in watchtime) {
            embed.addField(watchtime[viewer].viewer, calcWatchtime(watchtime[viewer].watchtime), false);
        }
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("-")
                    .setLabel("Vorherige Seite")
                    .setStyle("PRIMARY")
                    .setDisabled(true),
                new MessageButton()
                    .setCustomId("+")
                    .setLabel("Nächste Seite")
                    .setStyle("PRIMARY"),
            );
        await interaction.reply({ embeds: [embed], components: [row] });
    },
};