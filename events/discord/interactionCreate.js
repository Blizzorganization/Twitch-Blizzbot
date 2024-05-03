import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from "discord.js";
import { ButtonStyle } from "discord.js";
import _ from "lodash";
import { calcWatchtime, getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";
/**
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").ButtonInteraction} interaction
 */
async function blacklistUpdate(client, interaction) {
    const table = getTable(
        _.sortBy(
            client.clients.twitch.blacklist[client.config.watchtimechannel].map((blEntry) => ({
                word: blEntry.blword,
                action: blEntry.action,
            })),
            "word",
        ),
    );
    /** @type {ActionRowBuilder<ButtonBuilder>} */
    const row = new ActionRowBuilder();
    row.setComponents(
        new ButtonBuilder().setCustomId("refresh-blacklist").setEmoji("🔄").setStyle(ButtonStyle.Primary),
    );
    await interaction.update({
        content: `In der Blacklist für ${client.config.watchtimechannel} sind die Wörter \
        \`\`\`fix\n${table.slice(0, 1900)}\`\`\` enthalten.`,
        components: [row],
    });
}

/**
 * @param {import("discord.js").ButtonInteraction} button
 * @returns {Promise<void>}
 */
async function handleButton(button) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient} */
    // @ts-expect-error -- the client instatiating the button is of instance DiscordClient so this client is also instance of DiscordClient
    const client = button.client;
    if (button.customId === "refresh-blacklist") return blacklistUpdate(client, button);
    const message = button.message;
    if (!["Watchtime", "**__Watchtime:__**"].includes(message.embeds[0]?.title)) return;
    const channel = message.embeds[0]?.description;
    if (!channel) {
        logger.error("Tried to read data from a nonexistent embed in the top10 slash command");
        return;
    }
    let page = parseInt(message.embeds[0].footer?.text.replace("Seite", ""));
    switch (button.customId) {
        case "-":
            page--;
            break;
        case "+":
            page++;
            break;
        default:
            break;
    }
    /** @type {ActionRowBuilder<ButtonBuilder>} */
    const updateRow = new ActionRowBuilder();
    updateRow.addComponents(
        new ButtonBuilder()
            .setCustomId("-")
            .setLabel("Vorherige Seite")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page == 1),
        new ButtonBuilder().setCustomId("+").setLabel("Nächste Seite").setStyle(ButtonStyle.Primary),
    );
    const editEmbed = new EmbedBuilder()
        .setTitle("Watchtime")
        .setColor(0xdfb82d)
        .setFooter({ text: `Seite${page}` })
        .setDescription(channel);
    const updateWatchtime = await client.clients.db.watchtimeList(channel, "alltime", 10, page);
    for (const viewer in updateWatchtime) {
        editEmbed.addFields({
            name: updateWatchtime[viewer].viewer,
            value: calcWatchtime(updateWatchtime[viewer].watchtime),
            inline: false,
        });
    }
    await button.update({ embeds: [editEmbed], components: [updateRow] });
}

/**
 *
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Interaction} interaction
 */
export async function event(client, interaction) {
    if (interaction.isButton()) {
        await handleButton(interaction);
        return;
    }
    if (!interaction.isCommand()) return;
    const commands = client.slashcommands;
    if (!commands.has(interaction.commandName)) return;
    try {
        commands.get(interaction.commandName).execute(interaction);
    } catch (e) {
        logger.error(e);
        await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
        return;
    }
}
