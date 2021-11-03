const { MessageActionRow, MessageButton } = require("discord.js");

exports.adminOnly = true;
/**
 * @name blacklist
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 */
exports.run = (client) => {
    client.blchannel.send({
        content: "```fix\n" + client.clients.twitch.blacklist[client.config.watchtimechannel].join("\n").slice(0, 1990) + "```",
        components: [
            new MessageActionRow()
                .setComponents(
                    new MessageButton()
                        .setCustomId("refresh-blacklist")
                        .setEmoji("🔄")
                        .setStyle("PRIMARY"),
                ),
        ],
    });
};