const { MessageEmbed } = require("discord.js");

exports.alias = ["twitch"];
exports.adminOnly = false;
/**
 * @name tname
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 */
exports.run = async (client, message) => {
    const dcuser = message.mentions.users.first() || message.author;
    let dbuser = await client.clients.db.getDiscordConnection(dcuser);
    if (!dbuser) dbuser = "Du hast keinen Namen hinterlegt";
    const embed = new MessageEmbed()
        .setColor(0xedbc5d)
        .setThumbnail(dcuser.avatarURL())
        .setTitle("**__Linkinginfo__**")
        .addField("Discord-name", dcuser.username)
        .addField("Twitch-name", dbuser);

    message.channel.send({ embeds: [embed] });
};