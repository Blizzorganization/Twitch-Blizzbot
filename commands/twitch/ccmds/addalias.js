exports.help = false;
exports.perm = true;
/**
 * @name addalias
 * @namespace TwitchCommands
 * @param {import("../../../modules/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 */
exports.run = async (client, target, context, msg, self, args) => {
    if (args.length > 1) {
        let newcmd = args.shift().toLowerCase();
        let res = args.join(" ");
        if (!res || res == "") return client.say(target, "Du musst angeben, worauf der Alias verknüpft sein soll.");
        if (!await client.clients.db.getCcmd(target, res)) return client.say(target, "Diesen Befehl kenne ich nicht.");
        await client.clients.db.newAlias(target.replace(/#+/g, ""), newcmd, res);
        client.say(target, `Alias ${newcmd} für ${res} wurde hinzugefügt.`);
        client.clients.logger.log("command", `* Added Alias ${newcmd} for Customcommand ${res}`);
    } else {
        client.say(target, "Du musst angeben, welchen Alias und welchen Befehl du verwenden möchtest.");
    }
};