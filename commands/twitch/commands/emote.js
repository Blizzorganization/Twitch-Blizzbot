import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.mod;
/**
 * @name emotes
 * @namespace TwitchCommands
 * @param {import("twitch-blizzbot/twitchclient").TwitchClient} client
 * @param {string} target
 */
export async function run(client, target) {
    const subEmoteRequest = await fetch(`https://decapi.me/twitch/subscriber_emotes/${target.slice(1)}`);
    const subEmotes = await subEmoteRequest.text();
    if (subEmotes === "This channel does not have any subscriber emotes.") {
        // Wenn Keine vorhanden dann wird das nicht ausgegeben
        client.say(target, "Auf diesem Kanal sind keine Emotes verfügbar");
    } else {
        client.say(target, `Auf dem Kanal ${target.slice(1)} sind zur Zeit folgende Subscriber-emotes vorhanden: ${subEmotes}`);
    }
}