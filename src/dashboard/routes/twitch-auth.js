/** Dashboard-Routen: Twitch-Autorisierung (Streamer- und Bot-Account) */
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { signState } from "../auth.js";
import { restartEventSub } from "../../twitch/eventsub.js";
import { stopModLog, startModLog } from "../../twitch/modlog.js";
import { listTokenStatus, botTokenStatus, removeBotToken, removeChannelToken } from "../../twitch/api.js";
import { buildAuthorizeUrl, BOT_SCOPES } from "../../twitch/oauth.js";
import { logAudit } from "../../db/audit.js";
import { requireAdmin, wrap, publicBaseUrl } from "../context.js";

export function registerTwitchAuth(api) {
    /** Pro konfiguriertem Kanal: ob ein Token hinterlegt ist und dessen Broadcaster-User-ID (Mehrkanal-Übersicht). */
    api.get("/twitch-auth/status", requireAdmin, wrap(async (req, res) => res.json({ channels: await listTokenStatus(), bot: await botTokenStatus() })));

    /** Gemeinsame Logik: Streamer-Token eines Kanals entfernen, widerrufen, Dienste neu starten, Audit-Log. */
    async function dropChannelToken(req, res, channel) {
        if (!config.twitch.channels.includes(channel)) return res.status(400).json({ error: "Unbekannter Kanal." });
        const result = await removeChannelToken(channel);
        if (!result.removed) return res.status(404).json({ error: "Für diesen Kanal ist kein Token hinterlegt." });
        // Dienste, die dieses Token nutzen, neu starten (laufen danach ohne Token bzw. melden "kein Token")
        stopModLog().then(() => startModLog()).catch((e) => logger.warn(`Moderator-Aktionen-Erfassung konnte nicht neu gestartet werden: ${e.message}`));
        restartEventSub().catch((e) => logger.warn(`EventSub konnte nicht neu gestartet werden: ${e.message}`));
        logAudit({ actor: req.user?.username ?? "dashboard", action: "delete", targetType: "twitch-channel-token", target: channel, channel, details: { revoked: result.revoked } });
        res.json({ ok: true, revoked: result.revoked });
    }

    /** Admin: Streamer-Token eines beliebigen Kanals entfernen (Tab "Benutzer"). */
    api.delete("/twitch-auth/channel/:channel", requireAdmin, wrap((req, res) => dropChannelToken(req, res, String(req.params.channel ?? "").toLowerCase())));

    /** Entfernt den Bot-Account: Moderationsaktionen laufen danach wieder über den Streamer-Token. */
    api.delete("/twitch-auth/bot", requireAdmin, wrap(async (req, res) => {
        const status = await botTokenStatus();
        await removeBotToken();
        await stopModLog();
        startModLog().catch((e) => logger.warn(`Moderator-Aktionen-Erfassung konnte nicht neu gestartet werden: ${e.message}`));
        logAudit({ actor: req.user?.username ?? "dashboard", action: "delete", targetType: "twitch-bot-token", target: status.login ?? String(status.userId ?? ""), details: {} });
        res.json({ ok: true });
    }));

    /** Autorisierungs-URL für den BOT-Account (führt Löschen/Timeout/Ban/Raid-Follower-Modus aus). Dabei mit dem Bot-Account einloggen. */
    api.get("/twitch-auth/bot-url", requireAdmin, wrap(async (req, res) => {
        const base = publicBaseUrl(req);
        const redirectUri = `${base}/api/auth/twitch/callback`;
        res.json({ url: buildAuthorizeUrl(redirectUri, signState({ bot: true }), BOT_SCOPES) });
    }));

    /** Liefert die Twitch-Autorisierungs-URL für den Button "Anwendung autorisieren" im Tab "Benutzer". */
    api.get("/twitch-auth/url", requireAdmin, wrap(async (req, res) => {
        const channel = String(req.query.channel ?? "").toLowerCase();
        if (!config.twitch.channels.includes(channel)) return res.status(400).json({ error: "Unbekannter Kanal." });
        const base = publicBaseUrl(req);
        const redirectUri = `${base}/api/auth/twitch/callback`;
        const state = signState({ channel });
        res.json({ url: buildAuthorizeUrl(redirectUri, state) });
    }));
}
