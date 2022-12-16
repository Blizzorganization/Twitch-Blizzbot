import { MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { calcWatchtime, getTable } from "twitch-blizzbot/functions";
import { logger } from "twitch-blizzbot/logger";
import _ from "lodash";
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
    await interaction.update({
        content: `In der Blacklist für ${client.config.watchtimechannel} sind die Wörter \
        \`\`\`fix\n${table.slice(0, 1900)}\`\`\` enthalten.`,
        components: [
            new MessageActionRow().setComponents(
                new MessageButton().setCustomId("refresh-blacklist").setEmoji("🔄").setStyle("PRIMARY"),
            ),
        ],
    });
}

/**
 * @param {import("discord.js").ButtonInteraction} button
 */
async function handleButton(button) {
    /** @type {import("twitch-blizzbot/discordclient").DiscordClient} */
    // @ts-ignore
    const client = button.client;
    if (button.customId === "refresh-blacklist") return blacklistUpdate(client, button);
    const message = button.message;
    if (!["Watchtime", "**__Watchtime:__**"].includes(message.embeds[0]?.title)) return;
    const channel = message.embeds[0]?.description;
    if (!channel) return logger.error("Tried to read data from a nonexistent embed in the top10 slash command");
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
    const updateRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId("-")
            .setLabel("Vorherige Seite")
            .setStyle("PRIMARY")
            .setDisabled(page == 1),
        new MessageButton().setCustomId("+").setLabel("Nächste Seite").setStyle("PRIMARY"),
    );
    const editEmbed = new MessageEmbed()
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
export function event(client, interaction) {
    if (interaction.isButton()) {
        handleButton(interaction);
        return;
    }
    if (!interaction.isCommand()) return;
    const commands = client.slashcommands;
    if (!commands.has(interaction.commandName)) return;
    try {
        commands.get(interaction.commandName).execute(interaction);
    } catch (e) {
        logger.error(e);
        interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
        return;
    }
}
