const { permissions } = require("twitch-blizzbot/constants");

exports.help = true;
exports.perm = permissions.mod;
/**
 * @name emotes
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    const fetch = (await import("node-fetch")).default;
    const subEmoteRequest = await fetch(`https://decapi.me/twitch/subscriber_emotes/${target.slice(1)}`);
    const subEmotes = await subEmoteRequest.text();
    const bttvRequest = await fetch(`https://decapi.me/bttv/emotes/${target.slice(1)}`);
    const bttvEmotes = await bttvRequest.text();
    if (subEmotes === "This channel does not have any subscriber emotes.") {
        // Wenn Keine vorhanden dann wird das nicht ausgegeben
        client.say(target, `Auf dem Kanal${target.slice(1)} sind zur Zeit folgende Bettertwitch-Emote vorhanden: ${bttvEmotes}`);
    } else {
        client.say(target, `Auf dem Kanal${target.slice(1)} sind zur Zeit folgende Subscriber-emotes vorhanden: ${subEmotes}`);
    }


};