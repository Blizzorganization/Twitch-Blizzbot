import fetch from "node-fetch";
import { permissions } from "twitch-blizzbot/constants";

export const help = true;
export const perm = permissions.mod;
export const alias = ["emotes"];
/**
 * @author Speed-r
 * @name emotes
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
        await client.say(target, "Zur Auswahl stehen: sub | bttv");
        return;
    }
    // subscriber Emotes
    const sub = args[0];
    switch (sub.toLowerCase()) {
        case "sub":
        case "subscriber":
            {
                const subEmoteRequest = await fetch(`https://decapi.me/twitch/subscriber_emotes/${target.slice(1)}`);
                const subEmotes = await subEmoteRequest.text();
                if (subEmotes === "This channel does not have any subscriber emotes.") {
                    await client.say(target, "Auf diesem Kanal sind keine Sub-Emotes verfügbar");
                } else {
                    await client.say(
                        target,
                        `Auf dem Kanal ${target.slice(
                            1,
                        )} sind zur Zeit folgende Subscriber-Emotes vorhanden: ${subEmotes}`,
                    );
                }
            }
            break;
        // Bettertwitch Emotes
        case "bttv":
        case "bettertwitchtv":
            {
                const bttvRequest = await fetch(`https://decapi.me/bttv/emotes/${target.slice(1)}`);
                const bttvEmotes = await bttvRequest.text();
                if (bttvEmotes === `Unable to retrieve BetterTTV details for channel: ${target.slice(1)}`) {
                    await client.say(target, "Auf diesem Kanal sind keine BTTV-Emotes verfügbar");
                } else {
                    await client.say(
                        target,
                        `Auf dem Kanal ${target.slice(1)} sind folgende BTTV-Emotes vorhanden: ${bttvEmotes}`,
                    );
                }
            }
            break;
        default:
            await client.say(target, "Zur Auswahl stehen: sub | bttv");
            break;
    }
}
