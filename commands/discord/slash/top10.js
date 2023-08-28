import { ButtonStyle } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { calcWatchtime } from "twitch-blizzbot/functions";

export const data = new SlashCommandBuilder().setName("top10").setDescription("Watchtime Ranking").toJSON();
/**
 * @name watchtimechannel
 * @namespace DiscordCommands
 * @param  {import("discord.js").ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
    // @ts-ignore
    const client = interaction.client;
    const channel = client.config.watchtimechannel;
    const page = 1;
    const embed = new EmbedBuilder()
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
    /** @type {ActionRowBuilder<ButtonBuilder>} */
    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId("-")
            .setLabel("Vorherige Seite")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder().setCustomId("+").setLabel("Nächste Seite").setStyle(ButtonStyle.Primary),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}
