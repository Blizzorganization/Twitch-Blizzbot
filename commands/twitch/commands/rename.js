import { permissions } from "twitch-blizzbot/constants";

export const help = false;
export const perm = permissions.dev;
/** @type {string[]} */
export const alias = [];
/**
 * @name renameWatchtimeUser
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 * @param {import("tmi.js").ChatUserstate} context
 * @param {string} _msg
 * @param {boolean} _self
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(client, target, context, _msg, _self, args) {
    if (!args || args.length == 0) {
        await client.say(target, "Du musst einen neuen Namen angeben.");
        return;
    }
    const oldName = args[0].toLowerCase();
    const newName = context["username"];
    const existingUser = await client.clients.db.getWatchtime(target, newName, "alltime");
    if (existingUser) {
        await client.say(
            target,
            "Dieser Nutzer hat bereits watchtime gesammelt. Wenn du die watchtime dieses Accounts trotzdem übertragen möchtest, wende dich bitte an eine:n Moderator:in",
        );
        return;
    }
    await client.clients.db.renameWatchtimeUser(target, oldName, newName);
    await client.say(target, `Deine Watchtime wurde erfolgreich von ${oldName} umgeschrieben.`);
}
