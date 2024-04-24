export const adminOnly = false;
/**
 * @name userlink
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
export async function run(client, message, args) {
    if (!args || !args[0]) {
        const msg = await message.channel.send("Du musst deinen Twitch Nutzernamen angeben.");
        const coll = msg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id });
        coll.on("collect", async (m) => {
            coll.stop();
            if (m.content.startsWith(`${client.config.prefix}`)) return;
            await handle(client, m, m.content.split(" "));
        });
    } else {
        await handle(client, message, args);
    }
}
/**
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function handle(client, message, args) {
    const name = args[0];
    if (!/^[a-zA-Z0-9][\w]{2,24}$/.test(name)) {
        await message.channel.send("Dies ist kein valider Twitch Nutzername.");
        return;
    }
    const previous = await client.clients.db.getDiscordConnection(message.author);
    await client.clients.db.newDiscordConnection(message.author, name.toLowerCase());
    await message.channel.send(
        previous == null || previous == undefined
            ? `Der Name **${name.toLowerCase()}** wurde erfolgreich eingetragen`
            : `Du hast deinen Namen von **${previous}** auf **${name.toLowerCase()}** geändert.`,
    );
}
