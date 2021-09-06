const { MessageEmbed } = require("discord.js");

exports.adminOnly = false;
/**
 * @name tname
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 */
exports.run = async (client, message) => {
    let dcuser = message.mentions.users.first() || message.author;
    var dbuser = await client.clients.db.getDiscordConnection(dcuser);
    if (!dbuser) dbuser = "Du hast keinen Namen hinterlegt";
    var embed = new MessageEmbed()
        .setColor(0xdfb82d)
        .setThumbnail(dcuser.avatarURL())
        .setTitle("**__Linkinginfo__**")
        .addField("Discord-name", dcuser.username)
        .addField("Twitch-name", dbuser);

    message.channel.send({ embeds: [embed] });
};