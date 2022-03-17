import { MessageEmbed } from "discord.js";
export const alias = ["hilfe"];
export const adminOnly = false;
/**
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 */
export function run(client, message) {
    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ format: "png" }))
        .setTitle("**__Der Bot kann folgende Befehle:__**")
        .addField("!twitchname", "Zeigt den Twitchnamen an der eingespeichert wurde")
        .addField("!top10", "Gibt die aktuellen Top10 der Watchtime liste wieder")
        .addField("!watchtime [Twitch-Name]", "Gibt die aktuelle watchtime des angegebenen Nutzers wieder")
        .addField("!link [Twitch-Name]", "Um deinen Twitchaccount mit Discord zu verbinden so das du nur noch !watchtime eingeben muss")
        .addField("!unlink [Twitch-Name]", "Entfernt die Verbindung zu deinem Twitch Account");

    message.channel.send({ embeds: [embed] });
}
