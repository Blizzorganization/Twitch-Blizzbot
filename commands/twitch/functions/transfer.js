import { permissions } from "twitch-blizzbot/constants";
import { logger } from "twitch-blizzbot/logger";

export const help = false;
export const perm = permissions.mod;
export const alias = ["tf"];
/**
 * @name transferCmd
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} msg
 * @param {boolean} self
 * @param {string[]} args
 */
export async function run(client, target, context, msg, self, args) {
    if (!args || !(args.length == 0)) {
        const cmd = args.shift().toLowerCase();
        const dbres = await client.clients.db.transferCmd(target, cmd);
        switch (dbres) {
            case "no_such_command": {
                const resolvedAlias = await client.clients.db.resolveAlias(target, cmd);
                if (resolvedAlias) {
                    logger.warn(`${cmd} is an alias so it's permissions didn't get changed.`);
                    return client.say(
                        target,
                        `'${cmd}' ist ein Alias, wenn du wechseln möchtest nutze bitte den Befehl ${resolvedAlias.command}.`,
                    );
                }
                return client.say(target, `Der Befehl ${cmd} ist nicht vorhanden.`);
            }
            case "ok":
                client.say(target, `Die Befehlsberechtigungen von ${cmd} wurden aktualisiert.`);
                logger.info(`* Changed Customcommand ${cmd}'s permissions `);
                break;
            default:
                client.say(target, "Ein unerwarteter Fehler ist aufgetreten.");
                logger.error(`Unknown Keyword at transfer command: ${dbres}`);
                break;
        }
    } else {
        client.say(
            target,
            "Du musst angeben, welcher Befehl zwischen Nutzerbefehl und Moderationsbefehl gewechselt werden soll.",
        );
    }
}
