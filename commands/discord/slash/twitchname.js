import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import fetch from "node-fetch";
import { time } from "twitch-blizzbot/functions";

export const data = new SlashCommandBuilder()
    .setName("twitchname")
    .setDescription("Frage einen Twitch Username ab")
    .addUserOption((input) =>
        input.setName("user").setRequired(true).setDescription("Ein Nutzer, wenn nicht du gemeint sein sollst"),
    )
    .toJSON();

/**
 * @name twitchname
 * @namespace DiscordCommands
 * @param  {import("discord.js").CommandInteraction} interaction
 */
export async function execute(interaction) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient}*/
    // @ts-ignore
    const client = interaction.client;
    const dcuser = interaction.options.getUser("user") || interaction.user;
    const twuser = await client.clients.db.getDiscordConnection(dcuser);
    if (!twuser) {
        return interaction.reply(`Der Nutzer ${dcuser.tag} hat keinen Namen hinterlegt.`);
    }
    const channel = client.config.watchtimechannel;
    const apitoken = client.clients.config.twitch.clientId;
    const resp = await fetch(`https://decapi.me/twitch/accountage/${twuser}`);
    const age = time(await resp.text());
    const res = await fetch(`https://decapi.me/twitch/followage/${channel}/${twuser}?token=${apitoken}`);
    const fage = time(await res.text());
    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(dcuser.avatarURL())
        .setTitle("**__Linkinginfo__**")
        .addFields(
            { name: "Discord-Name", value: dcuser.username },
            { name: "Twitch-Name", value: twuser },
            { name: "__Der Twitchaccount wurde erstellt vor__", value: age },
            { name: "__Folgt schon__", value: fage },
        );

    await interaction.reply({ embeds: [embed] });
}
