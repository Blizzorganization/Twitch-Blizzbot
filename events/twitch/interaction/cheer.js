/**
 * @listens cheer
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} channel
 * @param {import("tmi.js").ChatUserstate} userstate
 */
exports.event = (client, channel, userstate) => {

    // message for Action
    client.clients.logger.info(`${userstate.username} cheered ${userstate.bits} bits`);
    client.say(channel, `/me Danke ${userstate.username} für die ${userstate.bits} bits!`);
};