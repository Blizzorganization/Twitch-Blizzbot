import { logger } from "../utils/logger.js";
import { listAutomessages, isAutomessageEnabled } from "../db/automessages.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { apiConfigured, getStream } from "./api.js";
import { config } from "../config.js";

const TICK_MS = 30_000; // wie oft geprüft wird, ob für einen Kanal eine Nachricht fällig ist
const lastSent = new Map(); // channel -> Zeitstempel der letzten Automessage
const lastDelay = new Map(); // channel -> Intervall (Minuten), das NACH der zuletzt gesendeten Nachricht gilt
const chatCounts = new Map(); // channel -> Chat-Nachrichten insgesamt seit dem Start (zählt nur hoch)
const chatBaseline = new Map(); // Schlüssel (Kanal bzw. Kanal#ID einer einzelnen Nachricht) -> chatCounts-Stand bei der letzten Sendung
const positions = new Map(); // channel -> Index der nächsten Nachricht

/** Chat-Nachrichten seit der letzten Sendung der Reihum-Liste bzw. einer einzelnen Nachricht. */
const chatSince = (channelKey, baseKey) => (chatCounts.get(channelKey) ?? 0) - (chatBaseline.get(baseKey) ?? 0);

/** Von der Chat-Pipeline pro Nachricht aufgerufen (für die Bedingung "mindestens Z Chat-Nachrichten"). */
export function countChatMessage(channel) {
    const key = String(channel).replace(/^#/, "").toLowerCase();
    chatCounts.set(key, (chatCounts.get(key) ?? 0) + 1);
}

/**
 * Automessage wie im alten Bot: alle X Minuten die nächste Nachricht (reihum) im Chat,
 * standardmäßig nur wenn der Kanal live ist. Jede Nachricht kann im Dashboard ein EIGENES
 * Intervall bekommen – das gilt dann als Wartezeit bis zur nächsten Nachricht; ohne eigenen
 * Wert gilt weiterhin das Standard-Intervall des Kanals (Tab "Einstellungen"). Ein fester
 * 30-Sekunden-Takt prüft für jeden Kanal, ob die nächste Nachricht fällig ist.
 * @param {(channel: string, text: string) => void} say
 */
let timer = null;

export function startAutomessage(say) {
    const canCheckLive = apiConfigured();
    if (!canCheckLive) {
        logger.warn("Automessage: Live-Prüfung nicht möglich (Twitch-API nicht konfiguriert) – 'nur wenn live' wird ignoriert.");
    }

    clearInterval(timer);
    timer = setInterval(async () => {
        for (const channel of config.twitch.channels) {
            try {
                const settings = await getChannelSettings(channel);
                if (!(await isAutomessageEnabled(channel))) continue; // per !automessage off / Dashboard-Schalter aus

                const list = await listAutomessages(channel);
                if (!list.length) {
                    logger.debug(`Für den Kanal ${channel} sind keine automatischen Nachrichten angegeben.`);
                    continue;
                }
                const shared = list.filter((m) => !m.standalone); // reihum, gemeinsamer Takt
                const solo = list.filter((m) => m.standalone); // "einzeln": eigener Takt pro Nachricht
                const key = channel.toLowerCase();

                // Bedingungen gelten für den ganzen Kanal. Live-Prüfung und Zuschauerzahl teilen sich einen API-Aufruf (pro Runde nur einmal).
                let streamChecked = false;
                let streamResult = null;
                const allowed = async (baseKey) => {
                    if (settings.automessageMinChatMessages > 0 && chatSince(key, baseKey) < settings.automessageMinChatMessages) return false;
                    if ((settings.automessageOnlyLive || settings.automessageMinViewers > 0) && canCheckLive) {
                        if (!streamChecked) {
                            streamResult = await getStream(channel);
                            streamChecked = true;
                        }
                        if (settings.automessageOnlyLive && !streamResult) return false;
                        if (settings.automessageMinViewers > 0 && (streamResult?.viewer_count ?? 0) < settings.automessageMinViewers) return false;
                    }
                    return true;
                };

                // Höchstens eine Nachricht pro Runde und Kanal: sind zwei gleichzeitig fällig, kommen sie so mit 30 s Abstand.
                // 1) Reihum-Nachrichten (gemeinsames Intervall)
                if (shared.length) {
                    const delay = lastDelay.get(channel) ?? settings.automessageDelay;
                    if (delay > 0 && Date.now() >= (lastSent.get(channel) ?? 0) + delay * 60_000 && (await allowed(channel))) {
                        let pos = positions.get(channel) ?? 0;
                        if (pos >= shared.length) pos = 0;
                        const msg = shared[pos];
                        positions.set(channel, pos + 1 < shared.length ? pos + 1 : 0);
                        say(channel, msg.message);
                        lastSent.set(channel, Date.now());
                        chatBaseline.set(channel, chatCounts.get(key) ?? 0);
                        // Eigenes Intervall dieser Nachricht gilt bis zur nächsten; ohne eigenen Wert zählt ab jetzt wieder der Standard.
                        lastDelay.set(channel, msg.delay_minutes > 0 ? msg.delay_minutes : settings.automessageDelay);
                        continue;
                    }
                }
                // 2) Einzeln laufende Nachrichten (je ein eigener Zeitpunkt der letzten Sendung)
                for (const msg of solo) {
                    const delay = msg.delay_minutes > 0 ? msg.delay_minutes : settings.automessageDelay;
                    if (!delay || delay <= 0) continue;
                    const soloKey = `${channel}#${msg.id}`;
                    if (!lastSent.has(soloKey)) {
                        // Erste Sichtung (z. B. nach dem Start): ein volles Intervall abwarten statt sofort zu senden
                        lastSent.set(soloKey, Date.now());
                        chatBaseline.set(soloKey, chatCounts.get(key) ?? 0);
                        continue;
                    }
                    if (Date.now() < lastSent.get(soloKey) + delay * 60_000) continue;
                    if (!(await allowed(soloKey))) continue;
                    say(channel, msg.message);
                    lastSent.set(soloKey, Date.now());
                    chatBaseline.set(soloKey, chatCounts.get(key) ?? 0);
                    break;
                }
            } catch (e) {
                logger.warn(`Automessage für ${channel} fehlgeschlagen: ${e.message}`);
            }
        }
    }, TICK_MS).unref();
    logger.info("Automessage-Dienst gestartet (Intervall pro Nachricht einstellbar, geprüft alle 30 s).");
}

/** Beendet den Automessage-Takt (für einen geordneten Shutdown, siehe stopTwitchBot). */
export function stopAutomessage() {
    clearInterval(timer);
    timer = null;
}
