import { logger } from "twitch-blizzbot/logger";

/**
 * @name addAlias
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (args.length <= 1) {
        await message.reply({ content: "Du musst angeben, welchen Alias und welchen Befehl du verwenden möchtest." });
        return;
    }
    const newcmd = args.shift().toLowerCase();
    const res = args.join(" ");
    if (!res || res == "") {
        await message.reply({ content: "Du musst angeben, worauf der Alias verknüpft sein soll." });
        return;
    }
    if (!(await client.clients.db.getCcmd(twchannel, res))) {
        await message.reply({ content: "Diesen Befehl kenne ich nicht." });
        return;
    }
    await client.clients.db.newAlias(twchannel, newcmd, res);
    await message.reply({ content: `Der Alias ${newcmd} für ${res} wurde hinzugefügt.` });
    logger.log("command", `* Added Alias ${newcmd} for Customcommand ${res}`);
}
