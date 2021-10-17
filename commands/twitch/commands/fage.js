const fetch = require("node-fetch").default;
exports.help = true;
exports.perm = false;
exports.alias = ["folgezeit", "followage"];
/**
 * @name followage
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    let user = args[0];
    if (!user || user == "") user = context["display-name"];
    const resp = await fetch(`https://2g.be/twitch/following.php?user=${user}&channel=${target.slice(1)}&format=mwdhms`);
    const followage = (await resp.text())
        .replace("years", "Jahren").replace("year", "Jahr")
        .replace("months", "Monaten").replace("month", "Monat")
        .replace("weeks", "Wochen").replace("week", "Woche")
        .replace("days", "Tage").replace("day", "Tag")
        .replace("hours", "Stunden").replace("hour", "Stunde")
        .replace("minutes", "Minuten").replace("minute", "Minute")
        .replace("seconds", "Sekunden").replace("second", "Sekunde")
        .replace("has been following", "folgt").replace("for", "seit")
        .replace("is not following", "ist kein Follower von");

    client.say(target, followage);
};