exports.adminOnly = false;
/**
 * @name link
 * @namespace DiscordCommands
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
exports.run = async (client, message, args) => {
    if (!args || !args[0]) {
        const msg = await message.channel.send("Du musst deinen Twitch Nutzernamen angeben.");
        const coll = msg.channel.createMessageCollector((m => m.author.id == message.author.id));
        coll.on("collect", (m) => {
            coll.stop();
            if (m.content.startsWith(`${client.config.prefix}`)) return;
            handle(client, m, m.content.split(" "));
        });
    } else {
        handle(client, message, args);
    }
};
/**
 * @param {import("../../../modules/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
async function handle(client, message, args) {
    const name = args[0];
    if (!(/^[a-zA-Z0-9][\w]{2,24}$/.test(name))) return message.channel.send("Dies ist kein valider Twitch Nutzername.");
    const previous = await client.clients.db.getDiscordConnection(message.author);
    await client.clients.db.newDiscordConnection(message.author, name.toLowerCase());
    message.channel.send(previous == null || previous == undefined ? `Der Name **${name.toLowerCase()}** wurde erfolgreich eingetragen` : `Du hast deinen Namen von **${previous}** auf **${name.toLowerCase()}** geändert.`);
}