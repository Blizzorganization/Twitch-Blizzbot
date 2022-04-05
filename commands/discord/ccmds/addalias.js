import { logger } from "twitch-blizzbot/logger";

/**
 * @name addAlias
 * @namespace DiscordCommands
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
export async function run(client, message, args) {
    const twchannel = client.config.watchtimechannel;
    if (args.length > 1) {
        const newcmd = args.shift().toLowerCase();
        const res = args.join(" ");
        if (!res || res == "") {
            return message.reply({ content: "Du musst angeben, worauf der Alias verknüpft sein soll." });
        }
        if (!(await client.clients.db.getCcmd(twchannel, res))) {
            return message.reply({ content: "Diesen Befehl kenne ich nicht." });
        }
        await client.clients.db.newAlias(twchannel, newcmd, res);
        message.reply({ content: `Der Alias ${newcmd} für ${res} wurde hinzugefügt.` });
        logger.log("command", `* Added Alias ${newcmd} for Customcommand ${res}`);
    } else {
        message.reply({ content: "Du musst angeben, welchen Alias und welchen Befehl du verwenden möchtest." });
    }
}
