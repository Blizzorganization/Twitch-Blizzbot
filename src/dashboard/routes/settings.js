/** Dashboard-Routen: Kanal-Einstellungen */
import { logger } from "../../utils/logger.js";
import { getChannelSettings, updateChannelSettings } from "../../db/channel-settings.js";
import { globalLinks, globalTlds } from "../../twitch/moderation.js";
import { restartEventSub } from "../../twitch/eventsub.js";
import { syncLevelingState } from "../../services/leveling.js";
import { refreshBotMods } from "../../db/bot-mods.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerSettings(api) {
    /* Kanal-Einstellungen (Cooldown, Raid, Automessage-Intervall, Link-Filter – pro Kanal, sonst eingebauter Standard) */
    api.get("/channel-settings", channelAccessMiddleware, wrap(async (req, res) => {
        const s = await getChannelSettings(channelOf(req));
        const raw = s._raw;
        const field = (value, rawKey) => ({ value, isDefault: raw[rawKey] === null || raw[rawKey] === undefined });
        res.json({
            cooldown: field(s.cooldown, "cooldown"),
            raidMinutes: field(s.raidMinutes, "raid_minutes"),
            raidMinViewers: field(s.raidMinViewers, "raid_min_viewers"),
            autoRaidEnabled: field(s.autoRaidEnabled, "auto_raid_enabled"),
            autoRaidMinViewers: field(s.autoRaidMinViewers, "auto_raid_min_viewers"),
            botModsOnly: field(s.botModsOnly, "bot_mods_only"),
            greetingsEnabled: field(s.greetingsEnabled, "greetings_enabled"),
            followAlertMax: field(s.followAlertMax, "follow_alert_max"),
            followAlertWindowSeconds: field(s.followAlertWindowSeconds, "follow_alert_window_seconds"),
            followModeMinutes: field(s.followModeMinutes, "follow_mode_minutes"),
            automessageDelay: field(s.automessageDelay, "automessage_delay"),
            automessageOnlyLive: field(s.automessageOnlyLive, "automessage_only_live"),
            automessageMinViewers: field(s.automessageMinViewers, "automessage_min_viewers"),
            automessageMinChatMessages: field(s.automessageMinChatMessages, "automessage_min_chat_messages"),
            blacklistEnabled: field(s.blacklistEnabled, "blacklist_enabled"),
            timersEnabled: field(s.timersEnabled, "timers_enabled"),
            linkFilter: field(s.linkFilter, "link_filter"),
            deleteActionMessages: field(s.deleteActionMessages, "delete_me_messages"),
            allowedLinks: field(s.allowedLinks ?? globalLinks(), "allowed_links"), // ohne eigene Liste: Inhalt von configs/links.txt
            tlds: field(s.tlds ?? globalTlds(), "tlds"), // ohne eigene Liste: Inhalt von configs/TLDs.txt
            giveawayRepeatMinutes: field(s.giveawayRepeatMinutes, "giveaway_repeat_minutes"),
            watchtimeEnabled: field(s.watchtimeEnabled, "watchtime_enabled"),
            watchtimeExcluded: field(s.watchtimeExcluded ?? [], "watchtime_excluded"),
            rewardsEnabled: field(s.rewardsEnabled, "rewards_enabled"),
            capsFilter: field(s.capsFilter, "caps_filter"),
            capsMinLength: field(s.capsMinLength, "caps_min_length"),
            capsMaxPercent: field(s.capsMaxPercent, "caps_max_percent"),
            emoteFilter: field(s.emoteFilter, "emote_filter"),
            emoteMaxCount: field(s.emoteMaxCount, "emote_max_count"),
            repeatFilter: field(s.repeatFilter, "repeat_filter"),
            repeatMaxCount: field(s.repeatMaxCount, "repeat_max_count"),
            charSpamFilter: field(s.charSpamFilter, "char_spam_filter"),
            charRunMax: field(s.charRunMax, "char_run_max"),
            charSymbolPercent: field(s.charSymbolPercent, "char_symbol_percent"),
            levelingEnabled: field(s.levelingEnabled, "leveling_enabled"),
            levelXpBase: field(s.levelXpBase, "level_xp_base"),
            levelXpMultiplier: field(s.levelXpMultiplier, "level_xp_multiplier"),
            xpPerMessage: field(s.xpPerMessage, "xp_per_message"),
            messageXpCooldownSeconds: field(s.messageXpCooldownSeconds, "message_xp_cooldown_seconds"),
            xpPerWatchMinute: field(s.xpPerWatchMinute, "xp_per_watch_minute"),
            pointsEnabled: field(s.pointsEnabled, "points_enabled"),
            pointsPerMessage: field(s.pointsPerMessage, "points_per_message"),
            messagePointsCooldownSeconds: field(s.messagePointsCooldownSeconds, "message_points_cooldown_seconds"),
            pointsPerWatchMinute: field(s.pointsPerWatchMinute, "points_per_watch_minute"),
        });
    }));
    api.put("/channel-settings", channelAccessMiddleware, wrap(async (req, res) => {
        const { levelXpBase: b, levelXpMultiplier: mul } = req.body;
        if (b != null && !(Number.isInteger(b) && b >= 1 && b <= 1_000_000)) return res.status(400).json({ error: "XP für Level 1 muss eine ganze Zahl zwischen 1 und 1.000.000 sein." });
        if (mul != null && !(Number(mul) >= 1 && Number(mul) <= 5)) return res.status(400).json({ error: "Der Faktor pro Level muss zwischen 1 und 5 liegen." });
        const { capsMinLength: cl, capsMaxPercent: cp, emoteMaxCount: ec } = req.body;
        if (cl != null && !(Number.isInteger(cl) && cl >= 1 && cl <= 500)) return res.status(400).json({ error: "Die Mindestlänge für den Caps-Filter muss zwischen 1 und 500 liegen." });
        if (cp != null && !(Number.isInteger(cp) && cp >= 30 && cp <= 100)) return res.status(400).json({ error: "Der Caps-Anteil muss zwischen 30 und 100 Prozent liegen." });
        if (ec != null && !(Number.isInteger(ec) && ec >= 1 && ec <= 100)) return res.status(400).json({ error: "Die maximale Emote-Anzahl muss zwischen 1 und 100 liegen." });
        const { repeatMaxCount: rc, charRunMax: cr, charSymbolPercent: cs } = req.body;
        if (rc != null && !(Number.isInteger(rc) && rc >= 2 && rc <= 20)) return res.status(400).json({ error: "Die Anzahl Wiederholungen muss zwischen 2 und 20 liegen." });
        if (cr != null && !(Number.isInteger(cr) && cr >= 5 && cr <= 200)) return res.status(400).json({ error: "Die Zeichenfolge muss zwischen 5 und 200 liegen." });
        if (cs != null && !(Number.isInteger(cs) && cs >= 30 && cs <= 100)) return res.status(400).json({ error: "Der Sonderzeichen-Anteil muss zwischen 30 und 100 Prozent liegen." });
        const { autoRaidMinViewers: arv } = req.body;
        if (arv != null && !(Number.isInteger(arv) && arv >= 1 && arv <= 1_000_000)) return res.status(400).json({ error: "Die Zuschauerzahl für den automatischen Raid-Schutz muss eine ganze Zahl ab 1 sein." });
        const { followAlertMax: fm, followAlertWindowSeconds: fw } = req.body;
        if (fm != null && !(Number.isInteger(fm) && fm >= 0 && fm <= 1000)) return res.status(400).json({ error: "Die Follower-Anzahl muss zwischen 0 (keine Begrenzung) und 1000 liegen." });
        if (fw != null && !(Number.isInteger(fw) && fw >= 5 && fw <= 3600)) return res.status(400).json({ error: "Das Zeitfenster muss zwischen 5 und 3600 Sekunden liegen." });
        if (req.body.watchtimeExcluded != null) {
            if (!Array.isArray(req.body.watchtimeExcluded) || req.body.watchtimeExcluded.length > 500) return res.status(400).json({ error: "Die Ausschlussliste muss eine Liste mit höchstens 500 Namen sein." });
            // Twitch-Namen: ohne @, klein, höchstens 25 Zeichen, ohne Doppelte
            req.body.watchtimeExcluded = [...new Set(req.body.watchtimeExcluded.map((n) => String(n).trim().replace(/^@/, "").toLowerCase()).filter((n) => n && n.length <= 25))];
        }
        await updateChannelSettings(channelOf(req), req.body);
        if ("botModsOnly" in req.body) await refreshBotMods(); // Rechte sofort umstellen
        if ("levelingEnabled" in req.body) await syncLevelingState(channelOf(req)); // Level-Up-Meldungen sofort stoppen/freigeben
        // Reward-System ein-/ausgeschaltet: Verbindung zu Twitch (EventSub) passend auf- bzw. abbauen
        if ("rewardsEnabled" in req.body) restartEventSub().catch((e) => logger.warn(`EventSub-Neustart fehlgeschlagen: ${e.message}`));
        res.json({ ok: true });
    }));
}
