exports.help = false;
exports.perm = true;
exports.silent = true;
/**
 * @name blacklist
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 */
exports.run = async (client, target, context) => {
    let bmsg = await client.clients.discord.blchannel.send(`In der Blacklist für ${target} sind die Wörter \
    \`\`\`fix\n${client.blacklist[target.replace(/#+/g, "")].join("\n")}\`\`\` enthalten.`);
    client.say(target, "Blacklist wurde gesendet");
    client.clients.logger.log("info", `* Sent the blacklist of ${target} to ${context.username}`);
    await bmsg.react("🔄");
    let coll = bmsg.createReactionCollector({ filter: (r, u) => r.emoji.name == "🔄" && u.id !== client.clients.discord.user.id });
    coll.on("collect", async (reaction) => {
        await reaction.remove();
        await bmsg.edit(`In der Blacklist für ${target} sind die Wörter \
        \`\`\`fix\n${client.blacklist[target.replace(/#+/g, "")].join("\n")}\`\`\` enthalten.`);
        bmsg.react("🔄");
    });
};