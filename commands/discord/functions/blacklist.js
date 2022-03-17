const { MessageActionRow, MessageButton } = require("discord.js");
const { getTable } = require("twitch-blizzbot/functions");

exports.adminOnly = true;
/**
 * @name blacklist
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 */
exports.run = (client) => {
    client.blchannel.send({
        content: `\`\`\`fix\n${getTable(client.clients.twitch.blacklist[client.config.watchtimechannel]).slice(0, 1990)}\`\`\``,
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