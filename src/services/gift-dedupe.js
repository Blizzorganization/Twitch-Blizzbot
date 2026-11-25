/**
 * Verhindert, dass bei einem Mass-Gift ("X verschenkt 5 Subs an die Community") zusätzlich jeder einzelne
 * Gift-Sub eine eigene Meldung auslöst. Twitch schickt zuerst die Community-Meldung und danach pro verschenktem
 * Sub ein eigenes Gift-Event - beide gehören zusammen.
 *
 * Zwei Wege, die Einzel-Events zuzuordnen:
 *  1. Dieselbe "origin-id" (Twitch gibt Mass-Gift und den dazugehörigen Einzel-Gifts dieselbe Kennung).
 *  2. Falls die Kennung fehlt: der Schenkende hat gerade ein Mass-Gift mit N Subs ausgelöst -> die nächsten
 *     N Einzel-Gifts desselben Schenkenden (innerhalb von 2 Minuten) gehören dazu.
 */
const WINDOW_MS = 120_000;
const origins = new Map(); // "kanal:origin" -> Zeitpunkt
const pending = new Map(); // "kanal:schenkender" -> { remaining, until }

const key = (channel, name) => `${String(channel).toLowerCase().replace(/^#/, "")}:${String(name ?? "anonym").toLowerCase()}`;

function cleanup(now) {
    for (const [k, t] of origins) if (now - t > WINDOW_MS) origins.delete(k);
    for (const [k, v] of pending) if (v.until < now) pending.delete(k);
}

/** Ein Mass-Gift wurde gemeldet: die dazugehörigen Einzel-Gifts merken. */
export function registerCommunityGift(channel, gifter, count, originId, now = Date.now()) {
    cleanup(now);
    if (originId) origins.set(key(channel, originId), now);
    if (count > 0) pending.set(key(channel, gifter), { remaining: count, until: now + WINDOW_MS });
}

/** true = dieses Einzel-Gift gehört zu einem Mass-Gift und soll keine eigene Meldung/Zählung auslösen. */
export function isPartOfCommunityGift(channel, gifter, originId, now = Date.now()) {
    cleanup(now);
    const p = pending.get(key(channel, gifter));
    if (originId && origins.has(key(channel, originId))) {
        if (p && p.remaining > 0) p.remaining -= 1; // bleibt mit der Zählung im Gleichschritt
        return true;
    }
    if (p && p.remaining > 0) {
        p.remaining -= 1;
        return true;
    }
    return false;
}
