import { config } from "../config.js";
import { allDiscordSettings, activeDiscordSettings } from "../db/discord-settings.js";

/** Gemeinsamer Zustand des Discord-Teils: der Client und ein paar Statusangaben für das Dashboard. */
let client;
const info = { startedAt: null, readyAt: null, lastError: null, registeredCommands: 0 };

export const getClient = () => client;
export const setClient = (c) => { client = c; };
export const clearClient = () => { client = undefined; info.readyAt = null; };
export const markStarted = () => { info.startedAt = Date.now(); info.lastError = null; };
export const markReady = () => { info.readyAt = Date.now(); };
export const markError = (e) => { info.lastError = String(e?.message ?? e); };
export const setRegisteredCommands = (n) => { info.registeredCommands = n; };

/** Status für das Dashboard (Übersicht). */
export function discordStatus() {
    const { token, clientId } = config.discord;
    const active = activeDiscordSettings();
    return {
        enabled: !!config.discord.enabled,
        configured: !!(token && clientId && active.some((s) => s.guildIds.length)),
        connected: !!client?.isReady?.(),
        guilds: client?.guilds?.cache?.size ?? 0,
        channels: active.length,
        registeredCommands: info.registeredCommands,
        connectedSince: info.readyAt,
        lastError: info.lastError,
        blacklistChannel: allDiscordSettings().some((s) => s.enabled && s.blacklistChannelId),
        sayChannel: allDiscordSettings().some((s) => s.enabled && s.sayChannelId),
    };
}
