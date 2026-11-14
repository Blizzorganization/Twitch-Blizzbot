import { getChannelSettings } from "../db/channel-settings.js";
import { getAlertEnabled, getAlertTemplate, getAlertAsAction, formatAlert } from "../db/alerts.js";
import { announce } from "./announce.js";
import { logger } from "../utils/logger.js";
import { cleanChannel } from "../db/init.js";

const recentFollows = new Map(); // channel -> Zeitpunkte aller Follows (auch unterdrückter) im Zeitfenster
const lastByUser = new Map(); // "kanal:name" -> Zeitpunkt (derselbe Nutzer löst höchstens einmal pro Stunde aus: Follow/Unfollow-Spam)
const floodActive = new Map(); // channel -> true, solange eine Flut läuft (nur für eine einzige Logzeile)
const SAME_USER_MS = 60 * 60_000;

/**
 * Bewertet einen neuen Follow: true = Meldung senden. Mehr als `max` Follower innerhalb von `windowSeconds` gelten als Flut
 * (Follower-Bots, Raid) - dann kommen keine Meldungen, bis es wieder ruhiger wird. Auch die unterdrückten Follows zählen
 * weiter mit, sonst würde nach kurzer Zeit wieder jeder Zweite durchrutschen.
 */
export function shouldAnnounceFollow(channel, username, { max, windowSeconds }, now = Date.now()) {
    const c = cleanChannel(channel);
    const userKey = `${c}:${String(username).toLowerCase()}`;
    if (now - (lastByUser.get(userKey) ?? -Infinity) < SAME_USER_MS) return false;
    lastByUser.set(userKey, now);
    if (lastByUser.size > 5000) for (const [k, t] of lastByUser) if (now - t >= SAME_USER_MS) lastByUser.delete(k);

    const list = (recentFollows.get(c) ?? []).filter((t) => now - t < windowSeconds * 1000);
    list.push(now);
    recentFollows.set(c, list);
    if (max > 0 && list.length > max) {
        if (!floodActive.get(c)) {
            floodActive.set(c, true);
            logger.warn(`Follow-Alert (${c}): mehr als ${max} Follower in ${windowSeconds} s - weitere Meldungen werden unterdrückt.`);
        }
        return false;
    }
    floodActive.set(c, false);
    return true;
}

/** Vom EventSub-Listener bei jedem neuen Follower aufgerufen. */
export async function handleFollow(channel, displayName, username) {
    if (!(await getAlertEnabled(channel, "follow"))) return;
    const s = await getChannelSettings(channel);
    if (!shouldAnnounceFollow(channel, username ?? displayName, { max: s.followAlertMax, windowSeconds: s.followAlertWindowSeconds })) return;
    const text = formatAlert(await getAlertTemplate(channel, "follow"), { user: displayName });
    announce(channel, text, await getAlertAsAction(channel, "follow"));
}
