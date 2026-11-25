import { getChannelSettings } from "../db/channel-settings.js";
import { setFollowersMode } from "../twitch/api.js";
import { logger } from "../utils/logger.js";

const timers = new Map(); // Kanal -> Timer der laufenden Pause (damit sich zwei Auslöser nicht überschneiden)

/**
 * Schaltet den Follower-Modus für die eingestellten Minuten aus und danach wieder an.
 * Wird vom Chat-Command !raid und (wenn im Dashboard aktiviert) automatisch bei einer eingehenden Raid benutzt.
 */
export async function startRaidPause(channel, say) {
    const { raidMinutes, followModeMinutes } = await getChannelSettings(channel);
    await setFollowersMode(channel, null);
    say(`Der Follower Modus wurde für die nächsten ${raidMinutes} Minuten deaktiviert.`);
    clearTimeout(timers.get(channel));
    const timer = setTimeout(async () => {
        timers.delete(channel);
        try {
            await setFollowersMode(channel, followModeMinutes);
            say("Der Follower Modus wurde Aktiviert.");
        } catch (e) {
            logger.warn(`Follower-Modus konnte nicht wieder aktiviert werden: ${e.message}`);
        }
    }, 60_000 * raidMinutes);
    timers.set(channel, timer);
}
