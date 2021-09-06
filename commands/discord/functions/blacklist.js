exports.adminOnly = true;
/**
 * @name blacklist
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client 
 * @param {import("discord.js").Message} message 
 */
exports.run = async (client, message) => {
    let msg = await message.channel.send("```fix\n" + client.clients.twitch.blacklist[client.config.watchtimechannel].join("\n").slice(0, 1990) + "```");
    await msg.react("🔄");
    let coll = msg.createReactionCollector({ filter: (r, u) => r.emoji.name == "🔄" && u.id !== client.clients.discord.user.id });
    coll.on("collect", async (reaction) => {
        await reaction.remove();
        await msg.edit(`In der Blacklist für ${client.config.watchtimechannel} sind die Wörter \
        \`\`\`fix\n${client.clients.twitch.blacklist[client.config.watchtimechannel].join("\n")}\`\`\` enthalten.`);
        msg.react("🔄");
    });
};