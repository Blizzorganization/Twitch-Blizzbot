import { EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import { time } from "twitch-blizzbot/functions";

export const alias = ["twitchnamen", "twname"];
export const adminOnly = false;
/**
 * @name twitchname
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @returns {Promise<void>}
 */
export async function run(client, message) {
    const dcuser = message.mentions.users.first() || message.author;
    let dbuser = await client.clients.db.getDiscordConnection(dcuser);
    if (!dbuser) dbuser = "Du hast keinen Namen hinterlegt";
    const channel = client.config.watchtimechannel;

    const resp = await fetch(`https://decapi.me/twitch/accountage/${dbuser}`);
    const age = time(await resp.text());
    const res = await fetch(`https://decapi.me/twitch/followage/${channel}/${dbuser}`);
    const fage = time(await res.text());

    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(dcuser.avatarURL())
        .setTitle("**__Linkinginfo__**")
        .addFields(
            { name: "__Discord-Name__", value: dcuser.username },
            { name: "__Twitch-name__", value: dbuser },
            { name: "__Der Twitchaccount wurde erstellt vor__", value: age },
            { name: "__Folgt schon__", value: fage },
        );

    await message.channel.send({ embeds: [embed] });
}
