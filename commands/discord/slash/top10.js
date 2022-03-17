const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { calcWatchtime } = require("twitch-blizzbot/functions");


module.exports = {
    data: {
        name: "top10",
        description: "Watchtime Ranking",
        type: 1,
        options: [],
    },
    /**
    * @param  {import("discord.js").CommandInteraction} interaction
    */
    execute: async (interaction) => {
        /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
        // @ts-expect-error
        const client = interaction.client;
        const channel = client.config.watchtimechannel;
        const page = 1;
        const embed = new MessageEmbed()
            .setTitle("**__Watchtime:__**")
            .setColor(0xedbc5d)
            .setDescription(channel)
            .setFooter({ text: `Seite ${page}` });
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