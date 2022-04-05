import { SlashCommandBuilder } from "@discordjs/builders";

export const data = new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Entferne die Verknüpfung zu deinem Twitch Account")
    .toJSON();

/**
 * @name userlink
 * @namespace DiscordCommands
 * @param  {import("discord.js").CommandInteraction} interaction
 */
export async function execute(interaction) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
    // @ts-ignore
    const client = interaction.client;
    const previous = await client.clients.db.getDiscordConnection(interaction.user);
    if (!previous) {
        return interaction.reply("Du hast keinen Twitchnamen hinterlegt, den ich löschen kann.");
    }
    await client.clients.db.deleteDiscordConnection(interaction.user);
    await interaction.reply(`Deine Verknüpfung zu **${previous}** wurde gelöscht.`);
}
