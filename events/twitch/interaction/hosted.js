/* eslint-disable no-unused-vars */
/**
 * @listens hosted
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {string} username
 * @param {number} viewers
 * @param {Boolean} autohost
 */
exports.event = (client, channel, username, viewers, autohost) => {

    // message for Action
    client.clients.logger.info(`${username} hosted ${viewers} viewer!`);
    client.say(channel, `/me ${username} Hosted mit ${viewers} Zuschauer!`);
};