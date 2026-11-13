import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { addWatchtime } from "../db/watchtime.js";
import { apiConfigured, getStream, getChatters } from "./api.js";
import { handleWatchLeveling } from "../services/leveling.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { endStreamPermits } from "../db/link-permits.js";

const INTERVAL_MS = 30_000; // wie im alten Bot: alle 30 s +1 Einheit (2 Einheiten = 1 Minute)

/**
 * Erfasst die Watchtime aller Chat-Teilnehmer, solange ein Kanal live ist.
 * Die Chatterliste kommt über die Twitch-API (Scope moderator:read:chatters), weil der
 * alte Weg (tmi.twitch.tv/group/user/.../chatters) nicht mehr existiert.
 */
let timer = null;

export function startWatchtime() {
    if (!apiConfigured()) {
        logger.warn("Watchtime-Erfassung ist aus: Twitch-API ist nicht konfiguriert (TWITCH_CLIENT_ID + Token).");
        return;
    }
    let running = false;
    let warned = null; // zuletzt gemeldeter Fehlertext (null = zuletzt alles in Ordnung)

    clearInterval(timer);
    timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            for (const channel of config.twitch.channels) {
                try {
                    const settings = await getChannelSettings(channel);
                    if (!settings.watchtimeEnabled) continue; // Modul für diesen Kanal aus (Dashboard -> Loyalty System -> Watchtime)
                    if (!(await getStream(channel))) { await endStreamPermits(channel); continue; } // offline (Link-Freigaben "bis Stream-Ende" enden hier)
                    const chatters = await getChatters(channel);
                    const excluded = new Set((settings.watchtimeExcluded ?? []).map((n) => n.toLowerCase()));
                    const names = chatters.map((c) => c.toLowerCase()).filter((c) => c.length <= 25 && !excluded.has(c)); // ausgeschlossene Nutzer sammeln weder Watchtime noch Watch-XP/-Punkte
                    await addWatchtime(channel, names);
                    handleWatchLeveling(channel, names).catch((e) => logger.warn(`Watch-XP/Punkte für ${channel} fehlgeschlagen: ${e.message}`));
                    warned = null; // alles in Ordnung: ein späterer Fehler wird wieder gemeldet
                } catch (e) {
                    if (warned !== e.message) {
                        warned = e.message; // gleiche Fehlermeldung nicht jede halbe Minute wiederholen, eine neue/andere schon
                        const hint = /connection|timeout|ECONN|postgres/i.test(e.message) ? "" : " (Scope moderator:read:chatters?)";
                        logger.warn(`Watchtime-Erfassung für ${channel} fehlgeschlagen${hint}: ${e.message}`);
                    }
                }
            }
        } finally {
            running = false;
        }
    }, INTERVAL_MS).unref();
    logger.info("Watchtime-Erfassung gestartet (alle 30 s, nur wenn live).");
}

/** Beendet die Watchtime-Erfassung (für einen geordneten Shutdown, siehe stopTwitchBot). */
export function stopWatchtime() {
    clearInterval(timer);
    timer = null;
}
