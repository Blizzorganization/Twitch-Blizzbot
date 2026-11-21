/** Dashboard-Routen: Discord-Einstellungen pro Twitch-Kanal (Verwaltung -> Discord, nur Admins). */
import { config } from "../../config.js";
import { logAudit } from "../../db/audit.js";
import { saveDiscordSettings, deleteDiscordSettings, discordSettingsFor, loadDiscordSettings } from "../../db/discord-settings.js";
import { reloadDiscord } from "../../discord/bot.js";
import { discordStatus } from "../../discord/state.js";
import { requireAdmin, wrap, channelOf, channelAccessMiddleware } from "../context.js";

const EMPTY = { enabled: true, guildIds: [], publicGuildIds: [], adminRoleId: "", blacklistChannelId: "", sayChannelId: "", embedColorHex: "" };

// Einladungs-Link des Bots: Scopes bot + applications.commands, Rechte: Kanäle ansehen, Nachrichten senden, Links einbetten, Verlauf lesen
const INVITE_PERMISSIONS = 1024n + 2048n + 16384n + 65536n;
function inviteUrl(guildId) {
    const { clientId } = config.discord;
    if (!clientId) return null;
    const q = new URLSearchParams({ client_id: clientId, scope: "bot applications.commands", permissions: String(INVITE_PERMISSIONS) });
    if (guildId) q.set("guild_id", guildId);
    return `https://discord.com/oauth2/authorize?${q}`;
}

const known = (channel) => config.twitch.channels.includes(channel);

export function registerDiscord(api) {
    api.get("/discord-settings", requireAdmin, channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        if (!known(channel)) return res.status(400).json({ error: "Unbekannter Kanal." });
        await loadDiscordSettings();
        const s = discordSettingsFor(channel);
        res.json({
            channel,
            configured: !!s,
            settings: s ? { ...EMPTY, ...s } : EMPTY,
            botEnabled: !!config.discord.enabled,
            hasToken: !!(config.discord.token && config.discord.clientId),
            status: discordStatus(),
            inviteUrl: inviteUrl(s?.guildIds?.[0]),
        });
    }));

    api.put("/discord-settings", requireAdmin, channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        if (!known(channel)) return res.status(400).json({ error: "Unbekannter Kanal." });
        // UserError (ungültige/doppelte IDs) wird von wrap als 400 beantwortet
        await saveDiscordSettings(channel, req.body ?? {});
        logAudit({ actor: req.user.username, action: "edit", targetType: "discord", target: channel, channel, details: {} });
        reloadDiscord(); // Registrierung bei Discord läuft im Hintergrund (kann dauern); Fehler stehen im Log
        res.json({ ok: true, warning: null, settings: { ...EMPTY, ...discordSettingsFor(channel) }, status: discordStatus() });
    }));

    api.delete("/discord-settings", requireAdmin, channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        if (!known(channel)) return res.status(400).json({ error: "Unbekannter Kanal." });
        const ok = await deleteDiscordSettings(channel);
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "discord", target: channel, channel, details: {} });
        reloadDiscord();
        res.json({ ok, warning: null, status: discordStatus() });
    }));
}
