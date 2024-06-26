import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setDescription("Verknüpfe deinen Twitch Account mit deinem Discord Account")
    .setName("link")
    .addStringOption((input) => input.setName("name").setRequired(true).setDescription("Twitch Userame"))
    .toJSON();

/**
 * @name userlink
 * @namespace DiscordCommands
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
    // @ts-expect-error -- Interaction is created by the DiscordClient and therefor references it
    const client = interaction.client;
    const name = interaction.options.getString("name").toLowerCase();
    const previous = await client.clients.db.getDiscordConnection(interaction.user);
    await client.clients.db.newDiscordConnection(interaction.user, name);
    await interaction.reply(
        previous == null || previous == undefined
            ? `Der Name **${name.toLowerCase()}** wurde erfolgreich eingetragen`
            : `Du hast deinen Namen von **${previous}** auf **${name.toLowerCase()}** geändert.`,
    );
}
