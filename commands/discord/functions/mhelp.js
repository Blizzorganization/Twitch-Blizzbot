import { EmbedBuilder } from "discord.js";
export const adminOnly = true;
/**
 * @name help
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @returns {Promise<void>}
 */
export async function run(client, message) {
    const embed = new EmbedBuilder()
        .setColor(0xedbc5d)
        .setThumbnail(client.user.avatarURL({ extension: "png" }))
        .setTitle("**__Alle Moderations Commands__**")
        .addFields(
            { name: "!add", value: "Fügt einen neuen Command in den Bot auf Twitch ein." },
            { name: "!addalias", value: "Fügt für einen Command einen Alias hinzu" },
            { name: "!addbl", value: "Fügt ein neues wort zur Blacklist hinzu." },
            { name: "!edit", value: "Bearbeitet einen Twitchcommand." },
            { name: "!del", value: "Löscht einen Command." },
            { name: "!delalias", value: "Löscht den angegebenen Alias vom Command" },
            { name: "!delbl", value: "Löscht ein wort von der Blacklist." },
            { name: "!cmd", value: "Zeigt alle Commands an." },
            { name: "!show", value: "Gibt den Text vom angegebenen Command wieder." },
            { name: "!mtime", value: "Zeigt an wie vie Zeit der Nutzer im Stream  verbracht hat" },
        );

    await message.channel.send({ embeds: [embed] });
}
