import { MessageEmbed } from "discord.js";
import fetch from "node-fetch";
import { time } from "twitch-blizzbot/functions";

export const alias = ["twitchnamen", "twname"];
export const adminOnly = false;
/**
 * @name twitchname
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
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

    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(dcuser.avatarURL())
        .setTitle("**__Linkinginfo__**")
        .addField("__Discord-name__", dcuser.username)
        .addField("__Twitch-name__", dbuser)
        .addField("__Der Twitchaccount wurde erstellt vor__", age)
        .addField("__Folgt schon__", fage);

    message.channel.send({ embeds: [embed] });
}
