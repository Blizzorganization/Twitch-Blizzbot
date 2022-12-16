import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { calcWatchtime } from "twitch-blizzbot/functions";

export const data = new SlashCommandBuilder().setName("top10").setDescription("Watchtime Ranking").toJSON();
/**
 * @name watchtimechannel
 * @namespace DiscordCommands
 * @param  {import("discord.js").CommandInteraction} interaction
 */
export async function execute(interaction) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
    // @ts-ignore
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
        embed.addFields({
            name: watchtime[viewer].viewer,
            value: calcWatchtime(watchtime[viewer].watchtime),
            inline: false,
        });
    }
    const row = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("-").setLabel("Vorherige Seite").setStyle("PRIMARY").setDisabled(true),
        new MessageButton().setCustomId("+").setLabel("Nächste Seite").setStyle("PRIMARY"),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}
