export const adminOnly = true;
/**
 * @name eval
 * @namespace DiscordCommands
 * @param {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
export async function run(client, message, args) {
    const permitted = client.config.evalUsers;
    if (!permitted.includes(message.author.id)) return;
    let evaled = eval(args.join(" "));
    if (evaled === false) evaled = "false";
    if (evaled === 0) evaled = "0";
    /** @type {string} */
    let response = evaled ? evaled.toString() : "Your command did not return any data.";
    if (!response || response.length == 0) response = "Your command did not return any data.";
    if (response.length > 2000) response = response.slice(0, 1999);
    await message.channel.send({ content: response });
}
