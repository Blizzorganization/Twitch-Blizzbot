/** Dashboard-Routen: Status-Übersicht und Statistiken */
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { getStats, setTotalSubs, getModActionStats, getModeratorActionStats, resetModeratorActionStats } from "../../db/events.js";
import { isAutomessageEnabled } from "../../db/automessages.js";
import { getChannelSettings } from "../../db/channel-settings.js";
import { isChatConnected } from "../../twitch/bot.js";
import { modLogStatus } from "../../twitch/modlog.js";
import { eventSubActive, eventSubFailure } from "../../twitch/eventsub.js";
import { listTokenStatus, botTokenStatus } from "../../twitch/api.js";
import { logAudit, getAuditStats } from "../../db/audit.js";
import { tokenProblems, tokenCheckedAt } from "../../services/token-health.js";
import { discordStatus } from "../../discord/state.js";
import { isAdminUser, requireAdmin, wrap, channelOf, channelAccessMiddleware, streamStatus } from "../context.js";

export function registerOverview(api) {
    /* Status-Übersicht (Startseite): Chat, Live-Status, Module, Bot-Account, letzte Fehler */
    api.get("/status", channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        const admin = await isAdminUser(req.user);
        const s = await getChannelSettings(channel);
        // Live-Status, Token-Übersicht, Automessage und Bot-Account gleichzeitig abfragen (statt nacheinander);
        // die Twitch-Abfrage ist gepuffert und hat ein Zeitlimit, damit die Seite nicht an Twitch hängt.
        const [stream, tokenStatus, automessageOn, botStatus] = await Promise.all([
            streamStatus(channel),
            listTokenStatus(),
            isAutomessageEnabled(channel),
            admin ? botTokenStatus() : null,
        ]);
        const tokenRow = tokenStatus.find((t) => t.channel === channel);
        res.json({
            chat: { connected: isChatConnected() },
            discord: config.discord.enabled ? { ...discordStatus(), lastError: admin ? discordStatus().lastError : null } : null,
            stream,
            modules: {
                leveling: !!s.levelingEnabled,
                watchtime: !!s.watchtimeEnabled,
                points: !!s.pointsEnabled,
                verifyMods: !!s.botModsOnly,
                greetings: !!s.greetingsEnabled,
                rewards: !!s.rewardsEnabled,
                automessage: automessageOn,
                blacklist: !!s.blacklistEnabled,
                timers: !!s.timersEnabled,
                linkFilter: !!s.linkFilter,
                // aktive Spam-Filter (leer = keiner an)
                spamFilters: [
                    s.capsFilter && "Caps",
                    s.emoteFilter && "Emotes",
                    s.repeatFilter && "Wiederholungen",
                    s.charSpamFilter && "Zeichen",
                ].filter(Boolean),
            },
            channelToken: !!tokenRow?.hasToken,
            tokenProblems: tokenProblems(channel, admin), // ungültige/ablaufende Tokens (Token-Überwachung)
            tokenCheckedAt: tokenCheckedAt(),
            bot: botStatus,
            modLog: modLogStatus().find((m) => m.channel === channel) ?? null,
            eventSub: eventSubActive(),
            eventSubFailure: eventSubFailure(),
            uptimeSeconds: Math.round(process.uptime()),
            errors: admin ? logger.recent(10) : null,
        });
    }));

    /* Stats */
    api.get("/stats", channelAccessMiddleware, wrap(async (req, res) => res.json(await getStats(channelOf(req)))));
    // Verlauf-Unterreiter: wie viele Commands/Aliase/Zähler/Zitate erstellt/bearbeitet/gelöscht wurden
    // (Audit-Log) sowie wie viele Moderationsaktionen (Nachricht gelöscht/Timeout/Bann) ausgeführt wurden.
    api.get("/stats/history", channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        res.json({ audit: await getAuditStats(channel), topTriggers: (await getModActionStats(channel)).topTriggers });
    }));
    // Unterreiter "Moderation" (nur Admins/Haupt-Admin): automatische Bot-Aktionen + Aktionen der Moderatoren
    api.get("/stats/moderation", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const channel = channelOf(req);
        res.json({ modActions: await getModActionStats(channel), moderatorActions: await getModeratorActionStats(channel) });
    }));
    // Moderator-Statistik leeren: nur Admins, höchstens einmal pro Kalendermonat
    api.post("/stats/moderation/reset", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const channel = channelOf(req);
        const result = await resetModeratorActionStats(channel);
        if (!result.ok) return res.status(409).json({ error: "Die Moderator-Aktionen wurden in diesem Monat schon geleert. Das ist erst im nächsten Monat wieder möglich." });
        logAudit({ actor: req.user.username, action: "delete", targetType: "mod-stats", target: "moderator-aktionen", channel, details: { removed: result.removed } });
        res.json({ ok: true });
    }));
    api.put("/subs", channelAccessMiddleware, wrap(async (req, res) => {
        const n = Number(req.body.total);
        if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: "total muss eine ganze Zahl >= 0 sein" });
        await setTotalSubs(channelOf(req), n);
        res.json({ ok: true });
    }));
}
