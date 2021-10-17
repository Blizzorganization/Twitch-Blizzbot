/**
 * @listens giftpaidupgrade
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 */
exports.event = (client, channel, username) => {

    // message for Action
    client.clients.logger.log("info", `${username} extended subcription`);
    client.say(channel, `/me ${username} hat seinen geschenkten Sub verlängert!`);
};