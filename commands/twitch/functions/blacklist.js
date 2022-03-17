const { MessageActionRow, MessageButton } = require("discord.js");
const { permissions } = require("twitch-blizzbot/constants");
const { getTable } = require("twitch-blizzbot/functions");

exports.help = false;
exports.perm = permissions.mod;
exports.silent = true;
/**
 * @name blacklist
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 */
exports.run = async (client, target, context) => {
    const user = context["display-name"];
    client.clients.discord.blchannel.send({
        content: `In der Blacklist für ${target} sind die Wörter \
        \`\`\`fix\n${getTable(client.blacklist[target.replace(/#+/g, "")])}\`\`\` enthalten.`,
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
    client.say(target, `${user} Blacklist wurde gesendet`);
    client.clients.logger.info(`* Sent the blacklist of ${target} to ${context.username}`);
};