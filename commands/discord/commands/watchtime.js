import { EmbedBuilder } from "discord.js";
import { calcWatchtime } from "twitch-blizzbot/functions";

export const alias = ["wt"];
export const adminOnly = false;
/**
 * @name watchtime
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
export async function run(client, message, args) {
    let user = "";
    if (!args || args.length == 0) {
        const dbuser = await client.clients.db.getDiscordConnection(message.author);
        if (dbuser) {
            user = dbuser;
        } else {
            message.channel.send("Du musst einen Nutzer angeben.");
            return;
        }
    }
    const channel = client.config.watchtimechannel;
    while (args.length > 0 && user == "") {
        if (user == "") {
            user = args.shift().toLowerCase();
        }
    }
    if (user == "") {
        return message.channel.send("Du musst angeben, für welchen Account du die Watchtime abfragen möchtest.");
    }
    const watchtime = await client.clients.db.getWatchtime(channel, user, "alltime");
    const maxWatchtime = await client.clients.db.getWatchtime(channel, client.clients.twitch.getUsername(), "alltime");
    if (!watchtime) return message.channel.send("Diesen Nutzer kenne ich nicht.");
    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ extension: "png" }))
        .setTitle("**__Watchtime__**")
        .addFields(
            { name: "Nutzername", value: user },
            { name: "Watchtime", value: `${calcWatchtime(watchtime)}` },
            { name: "Von der registrierten Zeit", value: `${Math.round((1000 * watchtime) / maxWatchtime) / 10}%` },
        );

    message.channel.send({ embeds: [embed] });
}
