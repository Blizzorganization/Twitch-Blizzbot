import { logger } from "../utils/logger.js";

let announcer = null;

/** Wird vom Twitch-Bot gesetzt, damit Dashboard-Aktionen im Chat ankündigen können. */
export function setAnnouncer(fn) {
    announcer = fn;
}

/** asAction: als /me (kursiv/farbig) statt als normale Nachricht senden. */
export function announce(channel, text, asAction = false) {
    if (!announcer) {
        logger.debug(`Ankündigung ohne Twitch-Verbindung verworfen (${channel}): ${text}`);
        return;
    }
    announcer(channel, text, asAction);
}
