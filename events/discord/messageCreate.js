/**
 * 
 * @param {import("../../modules/discordclient").DiscordClient} client 
 * @param {import("discord.js").Message} message 
 */
exports.event = (client, message) => {
    if (message.author.id == client.user.id) return;
    if (message.author.bot) return;
    let args = message.content.split(" ");
    let admincmd = false;
    switch (message.channel.id) {
        case client.config.channels.relay:
            var channel;
            if (client.clients.twitch.config.channels.length == 1) {
                channel = client.clients.twitch.config.channels[0];
            } else {
                channel = args.shift().toLowerCase();
            }
            if (!channel.startsWith("#")) return message.channel.send("Es wurde nicht angegeben, wo die Nachricht gesendet werden soll.");
            client.clients.twitch.say(channel, args.join(" "));
            break;
        case client.config.channels.adminCommands:
            admincmd = true;
        // eslint-disable-next-line no-fallthrough
        case client.config.channels.commands:
            if (!message.content.startsWith(client.config.prefix)) return;
            args = message.content.slice(client.config.prefix.length).split(" ");
            var commandName = args.shift().toLowerCase();
            var cmd = client.commands.get(commandName);
            if (!cmd) return;
            if (cmd.adminOnly == true && admincmd == false) return;
            cmd.run(client, message, args);
            break;
        default:
            break;
    }
};