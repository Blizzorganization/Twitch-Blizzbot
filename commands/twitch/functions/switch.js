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
 * @param {import("tmi.js").ChatUserstate} _context
 * @param {string} _msg
 * @param {boolean} _self
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, target, _context, _msg, _self, args) {
    if (!args || args.length == 0) {
        await client.say(target, "Du musst einen Befehl angeben.");
        return;
    }
    let cmdName = args[0].toLowerCase();
    if (cmdName.startsWith("!")) cmdName = cmdName.slice(1);
    const cmd = client.commands.get(cmdName);
    if (!cmd) {
        await client.say(target, "Diesen Befehl gibt es nicht.");
        return;
    }
    const dbCmd = await client.clients.db.resolveCommand(target, cmdName);
    if (dbCmd) {
        await client.clients.db.updateCommandEnabled(target, cmdName, !dbCmd.enabled);
        await client.say(
            target,
            `Der Befehl !${cmdName} ist jetzt ${dbCmd.enabled ? "ausgeschaltet" : "eingeschaltet"}.`,
        );
        return;
    }
    await client.clients.db.newCommand(target, cmdName, false, -1);
    await client.say(target, `Der Befehl !${cmdName} ist jetzt deaktiviert.`);
}
