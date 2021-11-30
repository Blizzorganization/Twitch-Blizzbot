exports.help = false;
exports.perm = true;
/**
 * @name delcounter
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    const user = context["display-name"];
    let cname;
    while (args.length > 0) {
        if (!cname || cname == "") cname = args.shift().toLowerCase();
    }
    if (cname) {
        await client.clients.db.delCounter(target.replace(/#+/g, ""), cname);
        client.say(target, `${user} Der Zähler ${cname} wurde entfernt.`);
        client.clients.logger.log("command", `* Deleted Counter ${cname}`);
    } else {
        client.say(target, "Du musst angeben, welchen Zähler du löschen möchtest.");
    }
};