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
        options: []
    },
    execute: async (interaction) => {
        /** @type {import("../../../modules/discordclient").DiscordClient}*/
        let client = interaction.client;
        let channel = client.config.watchtimechannel;
        let page = 1;
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
                    .setStyle("PRIMARY")
            );
        await interaction.reply({ embeds: [embed], components: [row] });
        const coll = interaction.channel.createMessageComponentCollector();
        coll.on("collect", async (i) => {
            switch (i.customId) {
                case "-":
                    page--;
                    break;
                case "+":
                    page++;
                    break;
                default:
                    break;
            }
            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId("-")
                        .setLabel("Vorherige Seite")
                        .setStyle("PRIMARY")
                        .setDisabled(page == 1),
                    new MessageButton()
                        .setCustomId("+")
                        .setLabel("Nächste Seite")
                        .setStyle("PRIMARY")
                );
            const editEmbed = new MessageEmbed()
                .setTitle("Watchtime")
                .setColor(0xdfb82d)
                .setFooter("Seite" + page)
                .setDescription(channel);
            const watchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
            for (const viewer in watchtime) {
                editEmbed.addField(watchtime[viewer].viewer, calcWatchtime(watchtime[viewer].watchtime), false);
            }
            await i.reply({ embeds: [editEmbed], components: [row] });
        });
        coll.on("end", async () => {
            interaction.editReply("Die Zeit ist abgelaufen.", await (interaction.fetchReply()).embed);
        });
    }
};