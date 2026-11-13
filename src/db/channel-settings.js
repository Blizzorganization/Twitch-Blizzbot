import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { config } from "../config.js";

export const DEFAULT_LEVEL_XP_BASE = 100;
export const DEFAULT_LEVEL_XP_MULTIPLIER = 1.345;

/** Spalte in channel_settings <-> Feldname (camelCase) <-> eingebauter Standardwert (siehe config.bot). */
const FIELDS = {
    cooldown: { column: "cooldown", default: () => config.bot.cooldown },
    raidMinutes: { column: "raid_minutes", default: () => config.bot.raidMinutes },
    raidMinViewers: { column: "raid_min_viewers", default: () => config.bot.raidMinViewers },
    // Automatik: bei einer eingehenden Raid ab so vielen Zuschauern den Follower-Modus wie bei !raid vorübergehend ausschalten
    autoRaidEnabled: { column: "auto_raid_enabled", default: () => false },
    autoRaidMinViewers: { column: "auto_raid_min_viewers", default: () => 10 },
    // Mindest-"Gefolgt"-Zeit (Minuten), mit der !raid den Follower-Modus nach der Raid-Pause wieder aktiviert
    followModeMinutes: { column: "follow_mode_minutes", default: () => config.bot.followModeMinutes },
    automessageDelay: { column: "automessage_delay", default: () => config.bot.automessageDelay },
    automessageOnlyLive: { column: "automessage_only_live", default: () => config.bot.automessageOnlyLive },
    automessageMinViewers: { column: "automessage_min_viewers", default: () => config.bot.automessageMinViewers },
    automessageMinChatMessages: { column: "automessage_min_chat_messages", default: () => config.bot.automessageMinChatMessages },
    blacklistEnabled: { column: "blacklist_enabled", default: () => config.bot.blacklistEnabled }, // Blacklist (Wörter) an/aus
    timersEnabled: { column: "timers_enabled", default: () => config.bot.timersEnabled }, // Timer (!timer / Dashboard) an/aus
    linkFilter: { column: "link_filter", default: () => config.bot.linkFilter },
    deleteActionMessages: { column: "delete_me_messages", default: () => config.bot.deleteActionMessages },
    allowedLinks: { column: "allowed_links", default: null }, // null = Standard kommt aus configs/links.txt (siehe moderation.js)
    tlds: { column: "tlds", default: null }, // null = Standard kommt aus configs/TLDs.txt
    // Minuten zwischen den "Giveaway läuft gerade"-Erinnerungen im Chat (0 = aus)
    giveawayRepeatMinutes: { column: "giveaway_repeat_minutes", default: () => config.bot.giveawayRepeatMinutes },
    // Spam-Filter: zu viele Großbuchstaben / zu viele Emotes in einer Nachricht (nur Nutzer ohne Rolle, Nachricht wird gelöscht)
    capsFilter: { column: "caps_filter", default: () => false },
    capsMinLength: { column: "caps_min_length", default: () => 10 }, // erst ab so vielen Buchstaben prüfen
    capsMaxPercent: { column: "caps_max_percent", default: () => 70 }, // ab so viel Prozent Großbuchstaben löschen
    emoteFilter: { column: "emote_filter", default: () => false },
    emoteMaxCount: { column: "emote_max_count", default: () => 10 }, // mehr Emotes als das werden gelöscht
    // Wiederholungen: dieselbe Nachricht (ohne Groß-/Kleinschreibung) so oft in 60 s -> ab dieser Anzahl löschen
    repeatFilter: { column: "repeat_filter", default: () => false },
    repeatMaxCount: { column: "repeat_max_count", default: () => 3 },
    // Zeichen-Spam: ein Zeichen X-mal hintereinander oder zu viele Sonderzeichen (Prozent, ab 10 Zeichen Länge)
    charSpamFilter: { column: "char_spam_filter", default: () => false },
    charRunMax: { column: "char_run_max", default: () => 15 },
    charSymbolPercent: { column: "char_symbol_percent", default: () => 60 },
    // Follow-Alert: mehr als followAlertMax Follower innerhalb von followAlertWindowSeconds = keine Meldungen mehr (Schutz vor Follower-Bots)
    // Nur die Nutzer aus der Verify-Mods-Liste (Dashboard/Discord) gelten als Moderator - mods.txt und Twitch-Abzeichen werden dann ignoriert
    greetingsEnabled: { column: "greetings_enabled", default: () => config.bot.greetingsEnabled },
    botModsOnly: { column: "bot_mods_only", default: () => config.bot.botModsOnly },
    followAlertMax: { column: "follow_alert_max", default: () => config.bot.followAlertMax },
    followAlertWindowSeconds: { column: "follow_alert_window_seconds", default: () => config.bot.followAlertWindowSeconds },
    // Punkte-Rewards (Channel Points): aus = Einlösungen werden nicht mehr protokolliert, im Dashboard lassen sich keine neuen anlegen
    rewardsEnabled: { column: "rewards_enabled", default: () => true },
    // Loyalty-System: Level-/XP-System
    // Modul "Watchtime-Erfassung" (zugleich Quelle für Watch-XP/-Punkte)
    watchtimeExcluded: { column: "watchtime_excluded", default: () => [] }, // Nutzer ohne Watchtime-Erfassung
    watchtimeEnabled: { column: "watchtime_enabled", default: () => config.bot.watchtimeEnabled },
    levelingEnabled: { column: "leveling_enabled", default: () => config.bot.levelingEnabled },
    // XP-Kurve: Level 1 kostet levelXpBase XP, jedes weitere Level levelXpMultiplier-mal so viel wie das vorherige
    levelXpBase: { column: "level_xp_base", default: () => DEFAULT_LEVEL_XP_BASE },
    levelXpMultiplier: { column: "level_xp_multiplier", default: () => DEFAULT_LEVEL_XP_MULTIPLIER },
    xpPerMessage: { column: "xp_per_message", default: () => config.bot.xpPerMessage },
    messageXpCooldownSeconds: { column: "message_xp_cooldown_seconds", default: () => config.bot.messageXpCooldownSeconds },
    xpPerWatchMinute: { column: "xp_per_watch_minute", default: () => config.bot.xpPerWatchMinute },
    // Loyalty-System: Punkte/Economy-System
    pointsEnabled: { column: "points_enabled", default: () => config.bot.pointsEnabled },
    pointsPerMessage: { column: "points_per_message", default: () => config.bot.pointsPerMessage },
    messagePointsCooldownSeconds: { column: "message_points_cooldown_seconds", default: () => config.bot.messagePointsCooldownSeconds },
    pointsPerWatchMinute: { column: "points_per_watch_minute", default: () => config.bot.pointsPerWatchMinute },
};

const ch = cleanChannel;

async function readRowFresh(channel) {
    const { rows } = await pool.query(`SELECT * FROM channel_settings WHERE channel = $1;`, [ch(channel)]);
    return rows[0] ?? null;
}

/**
 * Die Einstellungen werden bei JEDER Chatnachricht an mehreren Stellen gebraucht (Moderation, XP, Begrüßung, Commands) -
 * darum kurz im Speicher gehalten, statt jedes Mal die Datenbank zu fragen. Änderungen über updateChannelSettings
 * (Dashboard) leeren den Zwischenspeicher sofort; die Wartezeit greift nur bei Eingriffen direkt in der Datenbank.
 */
const SETTINGS_CACHE_MS = 15_000;
const rowCache = new Map(); // channel -> { at, row }
const rowInflight = new Map(); // channel -> Promise (läuft gerade; gleichzeitige Aufrufe teilen sich die Abfrage)

/** Zwischenspeicher eines Kanals (oder aller) verwerfen. */
export function invalidateChannelSettings(channel) {
    if (channel === undefined) {
        rowCache.clear();
        rowInflight.clear();
    } else {
        rowCache.delete(ch(channel));
        rowInflight.delete(ch(channel));
    }
}

async function readRow(channel) {
    const c = ch(channel);
    const hit = rowCache.get(c);
    if (hit && Date.now() - hit.at < SETTINGS_CACHE_MS) return hit.row;
    if (rowInflight.has(c)) return rowInflight.get(c);
    const p = readRowFresh(c)
        .then((row) => {
            if (rowInflight.get(c) === p) rowCache.set(c, { at: Date.now(), row });
            return row;
        })
        .finally(() => { if (rowInflight.get(c) === p) rowInflight.delete(c); });
    rowInflight.set(c, p);
    return p;
}

/**
 * Effektive Einstellungen eines Kanals: eigener Wert (aus der DB) wenn gesetzt,
 * sonst der eingebaute Standard. `raw` zeigt zusätzlich, was wirklich in der DB steht
 * (für das Dashboard, um "eigener Wert" von "Standard" zu unterscheiden).
 */
export async function getChannelSettings(channel) {
    const row = await readRow(channel);
    const result = {};
    for (const [field, { column, default: def }] of Object.entries(FIELDS)) {
        const raw = row ? row[column] : null;
        result[field] = raw !== null && raw !== undefined ? raw : def ? def() : null;
    }
    result._raw = row ?? {};
    return result;
}

/** Nur den Effektivwert eines einzelnen Felds lesen (praktisch für Hot-Path-Code). */
export async function getSetting(channel, field) {
    const settings = await getChannelSettings(channel);
    return settings[field];
}

/**
 * Setzt eigene Werte für einen Kanal. Ein Feld mit dem Wert `null` setzt es explizit
 * auf "Standard verwenden" zurück. Nicht angegebene Felder bleiben unverändert.
 */
export async function updateChannelSettings(channel, updates) {
    await ensureChannel(channel);
    invalidateChannelSettings(channel);
    const current = (await readRowFresh(channel)) ?? {};
    const merged = {};
    for (const [field, { column }] of Object.entries(FIELDS)) {
        merged[column] = field in updates ? updates[field] : (current[column] ?? null);
    }
    const columns = Object.values(FIELDS).map((f) => f.column);
    const values = columns.map((c) => merged[c] ?? null);
    await pool.query(
        `INSERT INTO channel_settings (channel, ${columns.join(", ")})
         VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(", ")})
         ON CONFLICT (channel) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")};`,
        [ch(channel), ...values],
    );
    invalidateChannelSettings(channel);
}

export const SETTINGS_FIELDS = FIELDS;
