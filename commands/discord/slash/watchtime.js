import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { calcWatchtime } from "twitch-blizzbot/functions";

export const data = new SlashCommandBuilder()
    .setName("watchtime")
    .setDescription("Watchtime")
    .addStringOption((input) =>
        input.setName("twitchuser").setRequired(false).setDescription("Twitch Userame eines Nutzers"),
    )
    .addUserOption((input) =>
        input.setName("user").setRequired(false).setDescription("Ein Nutzer, wenn nicht du gemeint sein sollst"),
    )
    .toJSON();

/**
 * @name watchtime
 * @namespace DiscordCommands
 * @param  {import("discord.js").ChatInputCommandInteraction} interaction
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
    // @ts-expect-error -- Interaction is created by the DiscordClient and therefor references it
    const client = interaction.client;
    const channel = client.config.watchtimechannel;
    const dcuser = interaction.options.getUser("user") || interaction.user;
    const twuser =
        interaction.options.getString("twitchuser") || (await client.clients.db.getDiscordConnection(dcuser));
    if (!twuser) {
        await interaction.reply("Du musst dich zuerst registrieren - /link");
        return;
    }
    const watchtime = await client.clients.db.getWatchtime(channel, twuser, "alltime");
    const maxWatchtime = await client.clients.db.getWatchtime(channel, client.clients.twitch.getUsername(), "alltime");
    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ extension: "png" }))
        .setTitle("**__Watchtime__**")
        .addFields(
            { name: "Nutzername", value: twuser },
            { name: "Watchtime", value: `${calcWatchtime(watchtime)}` },
            { name: "Von der registrierten Zeit", value: `${Math.round((1000 * watchtime) / maxWatchtime) / 10}%` },
        );
    await interaction.reply({ embeds: [embed] });
}
