/**
 * @listens raided
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} viewers
 */
exports.event = (client, channel, username, viewers) => {

    //message for Action
    client.clients.logger.log("info", `${username} raid ${viewers} viewer!`);
    if (viewers < 10) return;
    client.say(channel, `/me ${username} Raidet mit ${viewers} Zuschauer!`);
    if (viewers > 60) client.commands.get("raid").run(client, channel);
};