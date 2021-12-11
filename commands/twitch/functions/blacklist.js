const { permissions } = require("../../../modules/constants");

exports.help = false;
exports.perm = permissions.mod;
exports.silent = true;
/**
 * @name blacklist
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 */
exports.run = async (client, target, context) => {
    client.clients.discord.blchannel.send({
        content: `In der Blacklist für ${target} sind die Wörter \
        \`\`\`fix\n${client.blacklist[target.replace(/#+/g, "")].sort().join("\n")}\`\`\` enthalten.`,
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
    client.say(target, "Blacklist wurde gesendet");
    client.clients.logger.log("info", `* Sent the blacklist of ${target} to ${context.username}`);
};