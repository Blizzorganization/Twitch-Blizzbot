const { permissions } = require("twitch-blizzbot/constants");

exports.adminOnly = true;
/**
 * @param  {import("twitch-blizzbot/discordclient").DiscordClient} client
 * @param  {import("discord.js").Message} message
 * @param  {string[]} args
 */
exports.run = async (client, message, args) => {
    const twchannel = client.config.watchtimechannel;
    if (args.length > 1) {
        const newcmd = args.shift().toLowerCase();
        const res = args.join(" ");
        if (!res || res == "") return message.reply({ content: "Du musst angeben, was die Antwort sein soll." });
        await client.clients.db.newCcmd(twchannel, newcmd, res, permissions.user);
        message.reply({ content: `Der Befehl ${newcmd} wurde hinzugefügt.` });
        client.clients.logger.log("command", `* Added Customcommand ${newcmd}`);
    } else {
        message.reply({ content: "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest." });
    }
};