const fetch = require("node-fetch").default;

exports.help = true;
exports.perm = false;
exports.alias = ["alter"];
/**
 * @name age
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
    const resp = await fetch(`https://decapi.me/twitch/accountage/${user}`);
    const age = (await resp.text())
        .replace("years", "Jahren").replace("year", "Jahr")
        .replace("months", "Monaten").replace("month", "Monat")
        .replace("weeks", "Wochen").replace("week", "Woche")
        .replace("days", "Tage").replace("day", "Tag")
        .replace("hours", "Stunden").replace("hour", "Stunde")
        .replace("minutes", "Minuten").replace("minute", "Minute")
        .replace("seconds", "Sekunden").replace("second", "Sekunde");

    client.say(target, `Der Account ${user} wurde vor ${age} erstellt.`);
};