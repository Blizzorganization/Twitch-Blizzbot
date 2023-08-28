import { EmbedBuilder } from "discord.js";
export const alias = ["hilfe"];
export const adminOnly = false;
/**
 * @name help
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 */
export function run(client, message) {
    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ extension: "png" }))
        .setTitle("**__Der Bot kann folgende Befehle:__**")
        .addFields(
            { name: "!twitchname", value: "Fügt einen neuen Command in den Bot auf Twitch ein." },
            { name: "!top10", value: "Gibt die aktuellen Top10 der Watchtime liste wieder" },
            { name: "!watchtime [Twitch-Name]", value: "Gibt die aktuelle watchtime des angegebenen Nutzers wieder" },
            {
                name: "!link [Twitch-Name]",
                value: "Um deinen Twitchaccount mit Discord zu verbinden so das du nur noch !watchtime eingeben muss",
            },
            { name: "!unlink", value: "Entfernt die Verbindung zu deinem Twitch Account" },
        );

    message.channel.send({ embeds: [embed] });
}
