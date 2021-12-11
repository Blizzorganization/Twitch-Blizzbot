const { permissions } = require("../../../modules/constants");

exports.help = false;
exports.perm = permissions.mod;
/**
 * @name raid
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = (client, target) => {
    const minutes = client.config.Raidminutes;
    setTimeout(ende, 60000 * minutes);

    client.say(target, `/me Der Follower Modus wurde für die nächsten ${minutes} Minuten deaktiviert.`);
    client.say(target, "/followersoff");
    /**
     * starts follower only mode after timeout
     */
    function ende() {
        client.say(target, "/followers 5");
        client.say(target, "/me Der Follower Modus wurde Aktiviert.");
    }
};