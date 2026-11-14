import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { cleanChannel } from "../db/init.js";
import { logEvent } from "../db/events.js";
import { apiConfigured, helix, broadcasterId, getBotIdentity } from "./api.js";

/**
 * Erfasst Aktionen von MENSCHLICHEN Moderatoren (Nachricht gelöscht, Timeout, Bann) über Twitch EventSub
 * (Typ "channel.moderate", per WebSocket) und schreibt sie als Event "mod_action" in den event_log - für den
 * Abschnitt "Moderationsaktionen" im Dashboard (Statistiken -> Verlauf).
 *
 * Twitch liefert den Namen des handelnden Moderators nur über EventSub (nicht über den Chat/IRC).
 * Genutzt wird der Token des Bot-Accounts (falls autorisiert, sonst der API-Token des Kanals); dessen Besitzer
 * wird als Zuhörer eingetragen. Aktionen DIESES Accounts werden NICHT erfasst, weil das die automatischen
 * Aktionen des Bots sind (die zählen schon als "blacklist_hit"). Mit dem Bot-Account als Zuhörer werden
 * dafür auch die manuellen Aktionen des Streamers mitgezählt.
 *
 * Braucht zusätzliche Scopes (siehe oauth.js) - nach dem Update einmal im Dashboard neu autorisieren.
 */

const WS_URL = "wss://eventsub.wss.twitch.tv/ws";
const RETRY_MS = 10_000;
const LIMIT_RETRY_MS = 5 * 60_000; // bei Twitch-Verbindungslimit (429) nur alle 5 Minuten erneut versuchen
const ACTIONS = new Set(["delete", "timeout", "ban"]);

const states = new Map(); // channel -> { ws, stopped, keepalive, timer, retry, ownerId, broadcasterId, seen }

/** Wandelt ein channel.moderate-Event in { moderator, action, target, reason } um; null = nicht relevant. */
export function parseModerateEvent(event, ownerId = null) {
    if (!event || !ACTIONS.has(event.action)) return null;
    // Shared Chat: Aktionen, die in einem ANDEREN Kanal passiert sind, nicht diesem zurechnen
    if (event.source_broadcaster_user_id && event.source_broadcaster_user_id !== event.broadcaster_user_id) return null;
    if (ownerId && event.moderator_user_id === ownerId) return null; // eigene (automatische) Aktionen des Bots
    const info = event[event.action] ?? {};
    return {
        moderator: event.moderator_user_login ?? event.moderator_user_name ?? "unbekannt",
        action: event.action,
        target: info.user_login ?? info.user_name ?? null,
        reason: info.reason ?? null,
    };
}

async function subscribe(channel, state, sessionId) {
    await helix(channel, "/eventsub/subscriptions", {
        as: state.as,
        method: "POST",
        body: {
            type: "channel.moderate",
            version: "2",
            condition: { broadcaster_user_id: state.broadcasterId, moderator_user_id: state.ownerId },
            transport: { method: "websocket", session_id: sessionId },
        },
    });
    logger.diag(`Moderator-Aktionen: Erfassung für ${channel} läuft.`);
    state.backoff = false;
    if (state.problem) {
        state.problem = false;
        logger.ok(`Moderator-Aktionen: Erfassung für ${channel} wieder verbunden`);
    }
}

function armKeepalive(state, ws) {
    clearTimeout(state.timer);
    // Twitch sendet mindestens alle keepalive_timeout_seconds etwas; bleibt es still, ist die Verbindung tot.
    state.timer = setTimeout(() => {
        try {
            ws.close();
        } catch {
            /* ignorieren */
        }
    }, ((state.keepalive ?? 10) + 5) * 1000);
    state.timer.unref?.();
}

function scheduleRetry(channel, state) {
    if (state.stopped) return;
    clearTimeout(state.retry);
    state.retry = setTimeout(() => connect(channel, state), state.backoff ? LIMIT_RETRY_MS : RETRY_MS);
    state.retry.unref?.();
}

function connect(channel, state, url = WS_URL, isReconnect = false) {
    if (state.stopped) return;
    const ws = new WebSocket(url);
    const previous = state.ws;
    state.ws = ws;

    ws.onmessage = async (ev) => {
        let msg;
        try {
            msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
        } catch {
            return;
        }
        armKeepalive(state, ws);
        const type = msg.metadata?.message_type;
        try {
            if (type === "session_welcome") {
                state.keepalive = msg.payload?.session?.keepalive_timeout_seconds ?? 10;
                armKeepalive(state, ws);
                if (isReconnect) {
                    // Subscriptions wandern bei einem von Twitch angeforderten Reconnect automatisch mit.
                    try {
                        previous?.close();
                    } catch {
                        /* ignorieren */
                    }
                } else {
                    try {
                        await subscribe(channel, state, msg.payload.session.id);
                    } catch (e) {
                        const limit = /429|transports limit/i.test(String(e.message));
                        if (limit) {
                            // Zu viele WebSocket-Verbindungen für diesen Account: später erneut versuchen, nur einmal melden.
                            state.backoff = true;
                            if (!state.problem) {
                                state.problem = true;
                                logger.warn(
                                    `Moderator-Aktionen: Erfassung für ${channel} nicht möglich (${e.message}). ` +
                                        `Ich versuche es alle 5 Minuten erneut und melde, sobald es wieder klappt.`,
                                );
                            }
                        } else {
                            // Meist fehlende Berechtigungen (Scopes): nicht endlos neu versuchen, sondern einmal klar melden.
                            logger.warn(
                                `Moderator-Aktionen: Erfassung für ${channel} nicht möglich (${e.message}). ` +
                                    `Im Dashboard den Twitch-Zugang neu autorisieren (neue Berechtigungen nötig).`,
                            );
                            state.stopped = true;
                        }
                        ws.close();
                    }
                }
            } else if (type === "session_reconnect") {
                connect(channel, state, msg.payload.session.reconnect_url, true);
            } else if (type === "notification" && msg.payload?.subscription?.type === "channel.moderate") {
                const id = msg.metadata.message_id;
                if (state.seen.has(id)) return;
                state.seen.add(id);
                if (state.seen.size > 200) state.seen.delete(state.seen.values().next().value);
                const parsed = parseModerateEvent(msg.payload.event, state.ownerId);
                if (parsed) await logEvent(channel, "mod_action", parsed.moderator, parsed);
            } else if (type === "revocation") {
                logger.warn(`Moderator-Aktionen: Twitch hat die Erfassung für ${channel} beendet (${msg.payload?.subscription?.status}).`);
            }
        } catch (e) {
            logger.warn(`Moderator-Aktionen (${channel}): ${e.message}`);
        }
    };
    ws.onclose = () => {
        if (state.ws !== ws) return; // alte Verbindung nach einem Reconnect
        clearTimeout(state.timer);
        if (!state.stopped && !state.backoff && !state.problem) {
            state.problem = true;
            logger.warn(`Moderator-Aktionen: Verbindung für ${channel} getrennt, verbinde neu.`);
        }
        scheduleRetry(channel, state);
    };
    ws.onerror = () => {
        /* onclose folgt und kümmert sich um den Neuaufbau */
    };
}

export async function startModLog() {
    if (!apiConfigured()) return;
    if (typeof WebSocket === "undefined") {
        logger.warn("Moderator-Aktionen: Erfassung nicht möglich - Node.js 22 oder neuer (eingebauter WebSocket) wird benötigt.");
        return;
    }
    for (const raw of config.twitch.channels) {
        const channel = cleanChannel(raw);
        try {
            const bot = await getBotIdentity();
            const as = bot ? "bot" : undefined;
            const ownerId = bot ? bot.id : (await helix(channel, "/users"))?.data?.[0]?.id; // ohne Parameter = Besitzer des Tokens
            const state = {
                as,
                ws: null,
                stopped: false,
                keepalive: 10,
                timer: null,
                retry: null,
                ownerId,
                broadcasterId: await broadcasterId(channel),
                seen: new Set(),
            };
            if (!state.ownerId || !state.broadcasterId) throw new Error("Token-Besitzer oder Broadcaster-ID unbekannt");
            logger.diag(
                `Moderator-Aktionen: ${channel} wird über ${bot ? `den Bot-Account ${bot.login ?? bot.id}` : "den Kanal-Token (kein Bot-Account autorisiert)"} ` +
                    `erfasst (User-ID ${state.ownerId}${state.ownerId === state.broadcasterId ? " = Streamer-Account!" : ""}).`,
            );
            states.set(channel, state);
            connect(channel, state);
        } catch (e) {
            logger.warn(`Moderator-Aktionen: ${channel} übersprungen: ${e.message}`);
        }
    }
}

/** Zustand der Moderator-Aktionen-Erfassung je Kanal (für die Status-Übersicht im Dashboard). */
export function modLogStatus() {
    return [...states.entries()].map(([channel, s]) => ({
        channel,
        via: s.as === "bot" ? "bot" : "streamer",
        connected: !s.stopped && s.ws?.readyState === 1,
    }));
}

export async function stopModLog() {
    for (const state of states.values()) {
        state.stopped = true;
        clearTimeout(state.timer);
        clearTimeout(state.retry);
        try {
            state.ws?.close();
        } catch {
            /* ignorieren */
        }
    }
    states.clear();
}
