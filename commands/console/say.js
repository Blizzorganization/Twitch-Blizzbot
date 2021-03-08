exports.run = (clients, args) => {
    let channel;
    if (clients.twitch.config.channels.length == 1) {
        channel = clients.twitch.config.channels[0];
    } else {
        channel = args.shift();
        if (!channel.startsWith("#")) return console.error("No channel supplied, message will not be sent.");
    }
    clients.twitch.say(channel, args.join(" "));
}