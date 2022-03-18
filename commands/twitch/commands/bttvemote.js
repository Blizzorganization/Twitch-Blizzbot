import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.mod;
/**
 * @name bttvemotes
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const bttvRequest = await fetch(`https://decapi.me/bttv/emotes/${target.slice(1)}`);
    const bttvEmotes = await bttvRequest.text();
    if (bttvEmotes === `Unable to retrieve BetterTTV details for channel: ${target.slice(1)}`) {
        // Wenn Keine vorhanden dann wird das nicht ausgegeben
        client.say(target, "Auf diesem Kanal sind keine Bettertwitchemote verfügbar");
    } else {
        client.say(target, `Auf dem Kanal ${target.slice(1)} sind folgende Bttv-emotes vorhanden: ${bttvEmotes}`);
    }
}