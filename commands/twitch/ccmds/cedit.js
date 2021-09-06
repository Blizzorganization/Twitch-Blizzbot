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
    if (!args) return client.say(target, "Welchen Befehl möchtest du bearbeiten?");
    if (args.length > 1) {

        let cmd = await client.clients.db.getCcmd(target, args[0]);
        if (!cmd) return client.say(target, `Ich kenne keinen Befehl ${args[0]}.`);
        if (cmd.permissions !== permissions.mod) return client.say(target, `${args[0]} ist kein Mod Only Customcommand.`);

        let newcmd = args.shift().toLowerCase();
        let res = args.join(" ");
        await client.clients.db.editCcmd(target.replace(/#+/g, ""), newcmd, res);
        client.say(target, `Befehl ${newcmd} wurde bearbeitet.`);
        client.clients.logger.log("command", `* Edited Customcommand ${newcmd}`);
    }
};