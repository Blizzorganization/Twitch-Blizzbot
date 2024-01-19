export const adminOnly = false;
/**
 * @name userlink
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @returns {Promise<void>}
 */
export async function run(client, message) {
    const name = await client.clients.db.getDiscordConnection(message.author);
    if (!name) {
        await message.channel.send("Es existiert keine Twitch Verknüpfung, die ich löschen könnte.");
        return;
    }
    await client.clients.db.deleteDiscordConnection(message.author);
    await message.channel.send(`Deine Twitch Verknüpfung zu **${name}** wurde soeben gelöscht.`);
}
