import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.mod;
/** @type {string[]} */
export const alias = [];
/**
 * @name switch
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    if (!args || args.length == 0) {
        client.say(target, "Du musst einen Befehl angeben.");
        return;
    }
    let cmdName = args[0].toLowerCase();
    if (cmdName.startsWith("!")) cmdName = cmdName.slice(1);
    const cmd = client.commands.get(cmdName);
    if (!cmd) return client.say(target, "Diesen Befehl gibt es nicht.");
    const dbCmd = await client.clients.db.resolveCommand(target, cmdName);
    if (dbCmd) {
        client.clients.db.updateCommandEnabled(target, cmdName, !dbCmd.enabled);
        client.say(target, `Der Befehl ${cmdName} ist jetzt ${dbCmd.enabled ? "ausgeschaltet" : "eingeschaltet"}.`);
        return;
    }
    client.clients.db.newCommand(target, cmdName, false, -1);
    client.say(target, `Der Befehl ${cmdName} ist jetzt deaktiviert.`);
}
