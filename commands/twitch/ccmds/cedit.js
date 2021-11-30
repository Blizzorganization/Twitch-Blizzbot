const { permissions } = require("../../../modules/constants");

exports.help = false;
exports.perm = true;
/**
 * @name cedit
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    const user = context["display-name"];
    if (!args || args.length == 0) return client.say(target, "Welchen Befehl möchtest du bearbeiten?");

    const cmd = await client.clients.db.getCcmd(target, args[0]);
    if (!cmd) return client.say(target, `Ich kenne keinen Befehl ${args[0]}.`);
    if (cmd.permissions !== permissions.mod) return client.say(target, `${args[0]} ist kein Mod Only Customcommand.`);
    const newcmd = args.shift().toLowerCase();
    const res = args.join(" ");
    await client.clients.db.editCcmd(target.replace(/#+/g, ""), newcmd, res);
    client.say(target, `${user} Befehl ${newcmd} wurde bearbeitet.`);
    client.clients.logger.log("command", `* Edited Customcommand ${newcmd}`);
};