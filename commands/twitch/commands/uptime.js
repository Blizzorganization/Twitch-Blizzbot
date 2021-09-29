const fetch = require("node-fetch").default;
exports.help = true;
exports.perm = false;
/**
 * @name uptime
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 */
exports.run = async (client, target) => {
    let uptimerequest = await fetch(`https://decapi.me/twitch/uptime/${target.slice(1)}`, {});
    let uptime = (await uptimerequest.text())
        .replace("days", "Tagen").replace("day", "Tag")
        .replace("hours", "Stunden").replace("hour", "Stunde")
        .replace("minutes", "Minuten").replace("minute", "Minute")
        .replace("seconds", "Sekunden").replace("second", "Sekunde");
    if (uptime == `${target.slice(1)} is offline`) {
        client.say(target, `${target.slice(1)} ist offline.`);
    } else {
        client.say(target, `${target.slice(1)} ist seit ${uptime} live. blizzorLogo`);
    }
};