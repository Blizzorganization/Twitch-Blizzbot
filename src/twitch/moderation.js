import fs from "node:fs";
import { config, PERMISSIONS, BLACKLIST_TIMEOUTS, BLACKLIST_BAN } from "../config.js";
import { logger } from "../utils/logger.js";
import { findBlacklistHit } from "../db/blacklist.js";
import { logEvent } from "../db/events.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { deleteMessage, banUser } from "./api.js";
import { hasLinkPermit } from "../services/link-permit.js";
import { isBotMod, botModsOnly } from "../db/bot-mods.js";

/* ------------------- Listen aus configs/ (wie im alten Bot) ------------------- */

const cache = new Map(); // file -> { mtime, lines }

/** Liest eine Textliste (eine Zeile = ein Eintrag, # = Kommentar); lädt neu, wenn sich die Datei ändert. */
function loadList(file) {
    try {
        const mtime = fs.statSync(file).mtimeMs;
        const hit = cache.get(file);
        if (hit && hit.mtime === mtime) return hit.lines;
        const lines = fs
            .readFileSync(file, "utf8")
            .split(/\r\n|\n\r|\n|\r/)
            .map((l) => l.trim())
            .filter((l) => l !== "" && !l.startsWith("#"));
        cache.set(file, { mtime, lines });
        return lines;
    } catch {
        return [];
    }
}

export const globalLinks = () => loadList("configs/links.txt").map((l) => l.toLowerCase());
export const globalTlds = () => loadList("configs/TLDs.txt").map((l) => l.toLowerCase());
const permitList = () => loadList("configs/mods.txt").map((l) => l.toLowerCase());

/** Eigene Liste des Kanals (Dashboard) wenn vorhanden, sonst die globale Datei. */
const permittedLinks = (settings) => (settings.allowedLinks ?? globalLinks()).map((l) => l.toLowerCase());
const deleteTlds = (settings) => (settings.tlds ?? globalTlds()).map((l) => l.toLowerCase());

const linkTest = new RegExp(
    // eslint-disable-next-line no-control-regex
    "(^|[ \\t\\r\\n])((sftp|ftp|http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))",
    "g",
);

/**
 * Zu viele Großbuchstaben? Gezählt werden nur Buchstaben (Zahlen, Satzzeichen und Leerzeichen zählen nicht);
 * erst ab `minLetters` Buchstaben wird geprüft, damit kurze Nachrichten wie "LOL" nicht auffallen.
 */
export function isCapsSpam(message, minLetters = 10, maxPercent = 70) {
    const letters = message.match(/\p{L}/gu) ?? [];
    if (letters.length < minLetters) return false;
    const upper = letters.filter((c) => c !== c.toLowerCase() && c === c.toUpperCase()).length;
    return (upper / letters.length) * 100 >= maxPercent;
}

/**
 * Zeichen-Spam: ein Zeichen `maxRun`-mal oder öfter hintereinander ("aaaaaaaaaaaaaaaa") oder
 * mindestens `maxSymbolPercent` % Sonderzeichen (alles außer Buchstaben, Ziffern, Leerzeichen; erst ab 10 Zeichen).
 */
export function isCharSpam(message, maxRun = 15, maxSymbolPercent = 60) {
    const text = message.trim();
    if (new RegExp(`(.)\\1{${Math.max(1, maxRun - 1)},}`, "su").test(text)) return true;
    const visible = text.replace(/\s/g, "");
    if (visible.length < 10) return false;
    const symbols = visible.replace(/[\p{L}\p{N}]/gu, "").length;
    return (symbols / visible.length) * 100 >= maxSymbolPercent;
}

/* Wiederholungen: pro Kanal+Nutzer die Zeitpunkte gleicher Nachrichten der letzten 60 Sekunden (nur im Speicher) */
const REPEAT_WINDOW_MS = 60_000;
const recent = new Map(); // "kanal:nutzer" -> [{ text, at }]

/** true, wenn dieselbe Nachricht (ohne Groß-/Kleinschreibung) innerhalb von 60 s zum `maxCount`-ten Mal kommt. */
export function isRepeatSpam(channel, username, message, maxCount = 3, now = Date.now()) {
    const key = `${channel}:${String(username).toLowerCase()}`;
    const text = message.trim().toLowerCase().replace(/\s+/g, " ");
    const list = (recent.get(key) ?? []).filter((e) => now - e.at < REPEAT_WINDOW_MS);
    list.push({ text, at: now });
    recent.set(key, list);
    if (recent.size > 5000) for (const [k, v] of recent) if (now - v[v.length - 1].at >= REPEAT_WINDOW_MS) recent.delete(k);
    return list.filter((e) => e.text === text).length >= maxCount;
}

/* ------------------------------- Rechte ------------------------------- */

/** Höchste zutreffende Rechtestufe (wie hasPerm im alten Bot, aber mit max statt "erster Treffer"). */
export function getPermission(tags) {
    const name = String(tags.username ?? "").toLowerCase();
    let level = PERMISSIONS.EVERYONE;
    if (config.bot.devs.includes(name)) level = Math.max(level, PERMISSIONS.DEV);
    if (tags.badges?.broadcaster) level = Math.max(level, PERMISSIONS.BROADCASTER);
    if (tags.badges?.vip) level = Math.max(level, PERMISSIONS.VIP);
    if (tags.channel && botModsOnly(tags.channel)) {
        // Nur die Verify-Mods-Liste (Dashboard/Discord) zählt - mods.txt und Twitch-Mod-Abzeichen werden ignoriert
        if (isBotMod(tags.channel, name)) level = Math.max(level, PERMISSIONS.MODERATOR);
    } else if (config.bot.permit) {
        if (permitList().includes(name)) level = Math.max(level, PERMISSIONS.MODERATOR);
    } else if (tags.mod) {
        level = Math.max(level, PERMISSIONS.MODERATOR);
    }
    if (tags.subscriber) level = Math.max(level, PERMISSIONS.SUBSCRIBER);
    return level;
}

/* ------------------------- Moderationsaktionen (Helix) ------------------------- */

async function executeModAction(action, channel, tags, trigger) {
    const user = tags.username;
    try {
        if (action === BLACKLIST_BAN) {
            await banUser(channel, tags["user-id"], { reason: `Blacklisted word: ${trigger}` });
        } else if (BLACKLIST_TIMEOUTS[action]) {
            await banUser(channel, tags["user-id"], { duration: BLACKLIST_TIMEOUTS[action], reason: "Blacklisted word" });
        } else if (action === 0) {
            await deleteMessage(channel, tags.id);
        } else {
            logger.warn(`Unbekannte Blacklist-Aktion ${action} für "${trigger}"`);
        }
    } catch (e) {
        logger.warn(`Moderationsaktion ${action} für ${user} fehlgeschlagen: ${e.message}`);
    }
}

/**
 * Prüft eine Nachricht eines Nutzers OHNE Rolle (wie checkModAction im alten Bot):
 * Blacklist, nicht erlaubte Links, /me-Nachrichten.
 * @returns {Promise<boolean>} true, wenn die Nachricht moderiert wurde (dann keine Command-Verarbeitung)
 */
export async function checkModAction(channel, tags, msg) {
    if (getPermission(tags) > PERMISSIONS.EVERYONE) return false;
    const settings = await getChannelSettings(channel);
    const message = msg.toLowerCase();
    const args = msg.trim().split(" ");

    // 1) Blacklist – bei mehreren Treffern gewinnt die höchste Aktion
    const hit = settings.blacklistEnabled ? await findBlacklistHit(channel, msg) : null;
    if (hit) {
        await executeModAction(hit.action, channel, tags, hit.word);
        logEvent(channel, "blacklist_hit", tags.username, { word: hit.word, action: hit.action });
        return true;
    }

    if (settings.linkFilter) {
        // 2) www.-Links und Domain-Endungen aus TLDs.txt (oder eigener Liste), außer erlaubte Links
        const tlds = deleteTlds(settings);
        const permitted = permittedLinks(settings);
        const padded = ` ${message} `;
        if (padded.includes(" www.") || tlds.some((tld) => padded.includes(tld))) {
            const links = args.filter((a) => a.toLowerCase().includes("www") || tlds.some((tld) => a.toLowerCase().includes(tld)));
            const forbidden = links.filter((l) => !permitted.some((p) => l.toLowerCase().includes(p)));
            if (forbidden.length > 0 && !(await hasLinkPermit(channel, tags.username))) {
                await executeModAction(0, channel, tags, "link");
                logEvent(channel, "blacklist_hit", tags.username, { word: "link", action: 0 });
                return true;
            }
        }
    }

    // 3) /me-Nachrichten von Nutzern ohne Rolle
    if (settings.deleteActionMessages && tags["message-type"] === "action") {
        await executeModAction(0, channel, tags, "action");
        logEvent(channel, "blacklist_hit", tags.username, { word: "action", action: 0 });
        return true;
    }

    // 4) Spam-Filter: Großbuchstaben und Emote-Spam (Nachricht wird gelöscht)
    if (settings.capsFilter && isCapsSpam(msg, settings.capsMinLength, settings.capsMaxPercent)) {
        await executeModAction(0, channel, tags, "caps");
        logEvent(channel, "blacklist_hit", tags.username, { word: "caps", action: 0 });
        return true;
    }
    if (settings.emoteFilter && (tags.emoteCount ?? 0) > settings.emoteMaxCount) {
        await executeModAction(0, channel, tags, "emotes");
        logEvent(channel, "blacklist_hit", tags.username, { word: "emotes", action: 0 });
        return true;
    }

    if (settings.charSpamFilter && isCharSpam(msg, settings.charRunMax, settings.charSymbolPercent)) {
        await executeModAction(0, channel, tags, "zeichen-spam");
        logEvent(channel, "blacklist_hit", tags.username, { word: "zeichen-spam", action: 0 });
        return true;
    }
    if (settings.repeatFilter && isRepeatSpam(channel, tags.username, msg, settings.repeatMaxCount)) {
        await executeModAction(0, channel, tags, "wiederholung");
        logEvent(channel, "blacklist_hit", tags.username, { word: "wiederholung", action: 0 });
        return true;
    }

    // 5) http(s)://-Links, die nicht erlaubt sind
    if (settings.linkFilter) {
        const urls = message.match(linkTest);
        if (urls && urls.length > 0) {
            const permitted = permittedLinks(settings);
            if (urls.some((url) => !permitted.some((p) => url.includes(p))) && !(await hasLinkPermit(channel, tags.username))) {
                await executeModAction(0, channel, tags, "link");
                logEvent(channel, "blacklist_hit", tags.username, { word: "link", action: 0 });
                return true;
            }
        }
    }
    return false;
}
