const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");
const { calcWatchtime } = require("../../modules/functions");
/**
 * @param  {import("../../modules/discordclient").DiscordClient} client
 * @param  {import("discord.js").ButtonInteraction} interaction
 */
async function blacklistUpdate(client, interaction) {
    await interaction.update({
        content: `In der Blacklist für ${client.config.watchtimechannel} sind die Wörter \
        \`\`\`fix\n${client.clients.twitch.blacklist[client.config.watchtimechannel].sort().join("\n")}\`\`\` enthalten.`,
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
}

/**
 * @param {import("discord.js").ButtonInteraction} i
 */
async function handleButton(i) {
    if (i.customId == "refresh-blacklist") return blacklistUpdate(i.client, i);
    const message = i.message;
    if (message.embeds[0]?.title !== "Watchtime") return;
    const channel = message.embeds[0]?.description;
    // @ts-ignore
    if (!channel) return i.client.logger("Tried to read data from a nonexistent embed in the top10 slash command");
    let page = parseInt(message.embeds[0].footer?.text.replace("Seite", ""));
    switch (i.customId) {
        case "-":
            page--;
            break;
        case "+":
            page++;
            break;
        default:
            break;
    }
    const updateRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId("-")
                .setLabel("Vorherige Seite")
                .setStyle("PRIMARY")
                .setDisabled(page == 1),
            new MessageButton()
                .setCustomId("+")
                .setLabel("Nächste Seite")
                .setStyle("PRIMARY"),
        );
    const editEmbed = new MessageEmbed()
        .setTitle("Watchtime")
        .setColor(0xdfb82d)
        .setFooter({ text: `Seite${page}` })
        .setDescription(channel);
    // @ts-ignore
    const updateWatchtime = await i.client.clients.db.watchtimeList(channel, "alltime", 10, page);
    for (const viewer in updateWatchtime) {
        editEmbed.addField(updateWatchtime[viewer].viewer, calcWatchtime(updateWatchtime[viewer].watchtime), false);
    }
    await i.update({ embeds: [editEmbed], components: [updateRow] });
}


/**
 *
 * @param {import("../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Interaction} interaction
 */
exports.event = (client, interaction) => {
    if (interaction.isButton()) return handleButton(interaction);
    if (!interaction.isCommand()) return;
    const commands = client.slashcommands;
    if (!commands.has(interaction.commandName)) return;
    try {
        commands.get(interaction.commandName).execute(interaction);
    } catch (e) {
        client.clients.logger.error(e);
        return interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
    }
};