import { getChannelSettings } from "../db/channel-settings.js";
import { grantMessageXp, grantMessagePoints, grantWatchLeveling, levelFromXp, getCurve } from "../db/leveling.js";
import { ALERT_TYPES, formatAlert, getAlertTemplate, getAlertEnabled, getAlertAsAction } from "../db/alerts.js";
import { announce } from "./announce.js";
import { logger } from "../utils/logger.js";
import { cleanChannel } from "../db/init.js";

// Sofort wirksamer Schaltzustand (kommt vom Dashboard-Speichern), damit nach dem Ausschalten KEINE Level-Up-Meldung
// mehr rausgeht - auch nicht von Vorgängen, die gerade mitten in der Verarbeitung sind.
const levelingLive = new Map(); // channel -> boolean

/** Vom Dashboard nach dem Speichern der Einstellungen aufgerufen. */
export async function syncLevelingState(channel) {
    levelingLive.set(cleanChannel(channel), !!(await getChannelSettings(channel)).levelingEnabled);
}

const levelingOff = (channel) => levelingLive.get(cleanChannel(channel)) === false;

async function announceLevelUp(channel, user, level) {
    if (levelingOff(channel)) return;
    try {
        // Erneut prüfen, direkt vor dem Senden: wurde das Level-System inzwischen ausgeschaltet, kommt keine Meldung mehr.
        if (!(await getChannelSettings(channel)).levelingEnabled) return;
        if (levelingOff(channel)) return; // während der Abfrage ausgeschaltet
        if (!(await getAlertEnabled(channel, "levelup"))) {
            logger.debug(`Level-Up-Meldung für ${user} unterdrückt: Alert "Level-Up" ist im Dashboard ausgeschaltet.`);
            return;
        }
        const template = await getAlertTemplate(channel, "levelup");
        announce(channel, formatAlert(template, { user, level }), await getAlertAsAction(channel, "levelup"));
    } catch (e) {
        logger.warn(`Level-Up-Alert fehlgeschlagen: ${e.message}`);
    }
}

/** Von der Chat-Pipeline bei jeder Nachricht aufgerufen (vor dem Cooldown-/Spam-Schutz egal). */
export async function handleMessageXp(channel, tags) {
    const s = await getChannelSettings(channel);
    const displayName = tags["display-name"] ?? tags.username;
    if (s.levelingEnabled && s.xpPerMessage) {
        const result = await grantMessageXp(channel, tags.username, displayName, s.xpPerMessage, s.messageXpCooldownSeconds);
        if (result?.leveledUp) await announceLevelUp(channel, displayName, result.level);
    }
    // Punkte für Chatnachrichten (eigener Cooldown, unabhängig von den XP)
    if (s.pointsEnabled && s.pointsPerMessage > 0) {
        await grantMessagePoints(channel, tags.username, displayName, s.pointsPerMessage, s.messagePointsCooldownSeconds);
    }
}

/** Von der Watchtime-Erfassung (alle 30 s, nur live) für alle aktuellen Chatter aufgerufen. */
export async function handleWatchLeveling(channel, usernames) {
    const { levelingEnabled, pointsEnabled, xpPerWatchMinute, pointsPerWatchMinute } = await getChannelSettings(channel);
    const xpPerTick = levelingEnabled ? Math.round(xpPerWatchMinute / 2) : 0; // ein Tick = 30s = 0,5 Minute
    const pointsPerTick = pointsEnabled ? Math.round(pointsPerWatchMinute / 2) : 0;
    if (!xpPerTick && !pointsPerTick) return;
    const rows = await grantWatchLeveling(channel, usernames, xpPerTick, pointsPerTick);
    if (!xpPerTick) return;
    const curve = await getCurve(channel);
    for (const r of rows) {
        if (levelingOff(channel)) break; // mittendrin ausgeschaltet: keine weiteren Meldungen
        const newLevel = levelFromXp(Number(r.xp), curve);
        if (newLevel > levelFromXp(Number(r.old_xp), curve)) {
            await announceLevelUp(channel, r.display_name || r.username, newLevel);
        }
    }
}
