const { permissions } = require("../../../modules/constants");

exports.help = false;
exports.perm = true;
/**
 * @name cadd
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (args.length > 1) {
        const newcmd = args.shift().toLowerCase();
        const res = args.join(" ");
        if (!res || res == "") return client.say(target, "Du musst angeben, was die Antwort sein soll.");
        await client.clients.db.newCcmd(target.replace(/#+/g, ""), newcmd, res, permissions.mod);
        client.say(target, `Befehl ${newcmd} wurde hinzugefügt.`);
        client.clients.logger.log("command", `* Added Customcommand ${newcmd}`);
    } else {
        client.say(target, "Du musst angeben, welchen Befehl und welche Antwort du hinzufügen möchtest.");
    }
};