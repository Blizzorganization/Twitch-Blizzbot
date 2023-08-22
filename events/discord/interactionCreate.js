import { MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { calcWatchtime, getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";
/**
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").ButtonInteraction} interaction
 */
async function blacklistUpdate(client, interaction) {
    await interaction.update({
        content: `In der Blacklist für ${client.config.watchtimechannel} sind die Wörter \
        \`\`\`fix\n${getTable(client.clients.twitch.blacklist[client.config.watchtimechannel])}\`\`\` enthalten.`,
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
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient} */
    // @ts-ignore
    const client = i.client;
    if (i.customId === "refresh-blacklist") return blacklistUpdate(client, i);
    const message = i.message;
    if (message.embeds[0]?.title !== "Watchtime") return;
    const channel = message.embeds[0]?.description;
    if (!channel) return logger.error("Tried to read data from a nonexistent embed in the top10 slash command");
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
    const updateWatchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
    for (const viewer in updateWatchtime) {
        editEmbed.addField(updateWatchtime[viewer].viewer, calcWatchtime(updateWatchtime[viewer].watchtime), false);
    }
    await i.update({ embeds: [editEmbed], components: [updateRow] });
}


/**
 *
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Interaction} interaction
 */
export function event(client, interaction) {
    if (interaction.isButton()) return handleButton(interaction);
    if (!interaction.isCommand()) return;
    const commands = client.slashcommands;
    if (!commands.has(interaction.commandName)) return;
    try {
        commands.get(interaction.commandName).execute(interaction);
    } catch (e) {
        logger.error(e);
        return interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
    }
}