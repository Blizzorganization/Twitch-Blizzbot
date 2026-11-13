import { ApiClient } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { pool } from "../db/pool.js";
import { cleanChannel } from "../db/init.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { apiConfigured, broadcasterId, invalidateTokenCache, helix } from "./api.js";
import { handleRedemptionEvent } from "../services/channel-reward.js";
import { handleFollow } from "../services/follow-alert.js";
import { handleHypeTrainEnd } from "../services/hype-train.js";
import { getAlertEnabled } from "../db/alerts.js";

let listener = null;
let rewardChannelCount = 0; // Kanäle, für die gerade die Reward-Erfassung läuft (der Listener kann auch nur für Follow-Alerts laufen)
let failure = null; // Text, wenn die Erfassung wegen wiederholter Twitch-Fehler (z. B. 429) selbst gestoppt wurde
const MAX_SUBSCRIBE_FAILURES = 3; // so viele fehlgeschlagene Subscribe-Versuche in Folge, dann gibt der Bot auf (statt endlos alle 10 s)

async function loadTokenRow(channel) {
    const { rows } = await pool.query(`SELECT access_token, refresh_token FROM twitch_tokens WHERE channel = $1;`, [channel]);
    return rows[0] ? { accessToken: rows[0].access_token, refreshToken: rows[0].refresh_token } : { accessToken: null, refreshToken: null };
}

/** Fragt die echten Scopes/Restlaufzeit/Besitzer eines Tokens bei Twitch ab (für die interne Scope-Prüfung von twurple). */
export async function validateToken(accessToken) {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${accessToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? `Token-Validierung fehlgeschlagen (${res.status})`);
    return { scopes: data.scopes ?? [], expiresIn: data.expires_in ?? null, clientId: data.client_id, userId: data.user_id };
}

async function persistTokenRow(channel, token) {
    await pool.query(
        `INSERT INTO twitch_tokens (channel, access_token, refresh_token) VALUES ($1, $2, $3)
         ON CONFLICT (channel) DO UPDATE SET access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token, updated_at = now();`,
        [channel, token.accessToken, token.refreshToken],
    );
}

/**
 * Erfasst ALLE Punkte-Reward-Einlösungen eines Kanals in Echtzeit - auch manuell im Twitch-Dashboard
 * angelegte Rewards, nicht nur vom Bot selbst angelegte - über EventSub per WebSocket (@twurple/eventsub-ws).
 * Braucht den Scope channel:read:redemptions zusätzlich zu channel:manage:redemptions (siehe README).
 *
 * Nutzt dafür einen eigenen RefreshingAuthProvider (unabhängig vom Token-Cache in api.js), der mit
 * demselben Token aus der twitch_tokens-Tabelle startet und erneuerte Tokens dort auch wieder einträgt;
 * api.js wird per invalidateTokenCache() informiert, damit beide Seiten denselben aktuellen Token sehen.
 */
export async function startEventSub() {
    failure = null;
    if (!apiConfigured()) {
        logger.warn("Punkte-Reward-Erfassung (EventSub) ist aus: Twitch-API ist nicht konfiguriert.");
        return;
    }

    const authProvider = new RefreshingAuthProvider({
        clientId: config.twitchApi.clientId,
        clientSecret: config.twitchApi.clientSecret,
    });
    const channelByUserId = new Map();
    const features = new Map(); // channel -> { rewards, follow }
    authProvider.onRefresh(async (userId, newTokenData) => {
        const channel = channelByUserId.get(userId);
        if (!channel) return;
        await persistTokenRow(channel, { accessToken: newTokenData.accessToken, refreshToken: newTokenData.refreshToken });
        invalidateTokenCache(channel);
        logger.info(`EventSub: Token für ${channel} wurde erneuert.`);
    });

    for (const raw of config.twitch.channels) {
        const channel = cleanChannel(raw);
        try {
            // Reward-System für diesen Kanal ausgeschaltet (Dashboard): dann nur noch Follow-Alerts (falls der Token den Scope hat)
            const rewardsOn = !!(await getChannelSettings(channel)).rewardsEnabled;
            const id = await broadcasterId(channel);
            const token = await loadTokenRow(channel);
            if (!token.accessToken) {
                logger.warn(`EventSub: Für ${channel} ist kein Token hinterlegt, überspringe.`);
                continue;
            }
            // Die echten Scopes müssen von Twitch abgefragt werden (nicht leer lassen!) - sonst denkt
            // twurples interne Prüfung, der Token hätte GAR KEINE Scopes, und bricht sofort mit
            // "does not have any of the requested scopes" ab, selbst wenn der Token sie tatsächlich hat.
            const validated = await validateToken(token.accessToken);
            const wantRewards = rewardsOn && validated.scopes.includes("channel:read:redemptions");
            const wantFollow = validated.scopes.includes("moderator:read:followers");
            const hypeOn = await getAlertEnabled(channel, "hypetrain");
            const wantHype = hypeOn && validated.scopes.includes("channel:read:hype_train");
            if (hypeOn && !wantHype) logger.info(`EventSub: Für die Hype-Train-Zusammenfassung braucht der Token für ${channel} den Scope channel:read:hype_train - im Dashboard den Twitch-Zugang neu autorisieren.`);
            if (rewardsOn && !wantRewards) logger.warn(`EventSub: Der Token für ${channel} hat nicht den Scope channel:read:redemptions - keine Reward-Erfassung.`);
            if (!wantRewards && !wantFollow && !wantHype) {
                logger.info(`EventSub: Für ${channel} gibt es nichts zu erfassen (Reward-System aus bzw. Scope fehlt, kein Scope für Follow-Alerts), überspringe.`);
                continue;
            }
            // Zwei häufige, aber leicht zu übersehende Ursachen für Twitchs 403 "subscription missing
            // proper authorization", OBWOHL der Scope laut Token-Liste vorhanden ist:
            //  1) Der Token wurde über einen ANDEREN Client (z. B. ein Token-Generator-Tool) autorisiert als
            //     den hier in TWITCH_CLIENT_ID hinterlegten - Twitch verknüpft die Berechtigung mit dem
            //     Client, der die Autorisierung eingeholt hat, nicht nur mit dem Scope-Namen selbst.
            //  2) Der Token gehört nicht dem Broadcaster selbst, sondern z. B. nur einem Moderator-Account -
            //     für Punkte-Reward-Einlösungen muss es der Broadcaster-Token sein.
            if (validated.clientId && validated.clientId !== config.twitchApi.clientId) {
                // Auch das führt bei Twitch verlässlich zu 403 - hier ebenfalls gar nicht erst versuchen,
                // statt twurple alle paar Sekunden erfolglos erneut subscriben zu lassen.
                logger.warn(
                    `EventSub: Der Token für ${channel} wurde über eine ANDERE Twitch-App (Client-ID ${validated.clientId}) ` +
                        `autorisiert als die hier hinterlegte TWITCH_CLIENT_ID (${config.twitchApi.clientId}). ` +
                        `Deshalb lehnt Twitch die Reward-Einlösungen-Subscription mit 403 ab - der Token muss ` +
                        `über die eigene, in TWITCH_CLIENT_ID hinterlegte App (erneut) autorisiert werden. ` +
                        `Erfassung für ${channel} wird übersprungen.`,
                );
                continue;
            }
            if (validated.userId && validated.userId !== id) {
                // Twitch lehnt die Subscription für einen Nicht-Broadcaster-Token immer ab - die Einlösungen
                // für diesen Kanal gar nicht erst versuchen, sonst versucht twurple es alle paar Sekunden
                // erneut und spammt denselben 403-Fehler endlos in die Konsole.
                logger.debug(
                    `EventSub: Der Token für ${channel} gehört nicht dem Broadcaster selbst (Token-User-ID ${validated.userId}, ` +
                        `erwartet ${id}) - für Punkte-Reward-Einlösungen wird der Broadcaster-eigene Token benötigt. ` +
                        `Erfassung für ${channel} wird übersprungen, bis ein Broadcaster-Token hinterlegt ist.`,
                );
                continue;
            }
            await authProvider.addUser(
                id,
                {
                    accessToken: token.accessToken,
                    refreshToken: token.refreshToken,
                    expiresIn: validated.expiresIn,
                    obtainmentTimestamp: Date.now(),
                    scope: validated.scopes,
                },
                ["channel:read:redemptions", "moderator:read:followers", "channel:read:hype_train"],
            );
            channelByUserId.set(id, channel);
            features.set(channel, { rewards: wantRewards, follow: wantFollow, hype: wantHype });
        } catch (e) {
            logger.warn(`EventSub: Kanal ${channel} konnte nicht vorbereitet werden: ${e.message}`);
        }
    }

    if (!channelByUserId.size) {
        logger.info("Punkte-Reward-Erfassung (EventSub): kein Kanal zu erfassen (ausgeschaltet oder nicht vorbereitet) - keine Verbindung zu Twitch aufgebaut.");
        return;
    }

    // Diagnose gegen Fehler 429 "websocket transports limit exceeded": zeigt, wie viele WebSocket-Verbindungen
    // Twitch für diesen Account (mit dieser Client-ID) gerade als belegt ansieht und wie alt sie sind.
    for (const channel of channelByUserId.values()) await logWebsocketUsage(channel);

    const apiClient = new ApiClient({ authProvider });
    listener = new EventSubWsListener({ apiClient });

    rewardChannelCount = 0;
    for (const [userId, channel] of channelByUserId) {
        const f = features.get(channel);
        if (f?.rewards) {
            rewardChannelCount++;
            listener.onChannelRedemptionAdd(userId, (event) => {
                handleRedemptionEvent(channel, event).catch((e) =>
                    logger.warn(`Reward-Einlösung (${channel}) konnte nicht verarbeitet werden: ${e.message}`),
                );
            });
        }
        if (f?.follow) {
            // Der Streamer ist zugleich "Moderator" der Abfrage (sein Token trägt moderator:read:followers).
            listener.onChannelFollow(userId, userId, (event) => {
                handleFollow(channel, event.userDisplayName || event.userName, event.userName).catch((e) =>
                    logger.warn(`Follow-Alert (${channel}) konnte nicht verarbeitet werden: ${e.message}`),
                );
            });
        }
    }

    // Hype-Train-Ende (nur Zusammenfassung, kein Zwischenstand): V2-Event, sonst das ältere
    for (const [userId, channel] of channelByUserId) {
        if (!features.get(channel)?.hype) continue;
        const subscribe = listener.onChannelHypeTrainEndV2 ?? listener.onChannelHypeTrainEnd;
        if (typeof subscribe !== "function") {
            logger.info("EventSub: Die installierte twurple-Version kennt kein Hype-Train-Ende-Event - keine Zusammenfassung.");
            break;
        }
        subscribe.call(listener, userId, (event) => {
            handleHypeTrainEnd(channel, event).catch((e) => logger.warn(`Hype-Train-Zusammenfassung (${channel}) fehlgeschlagen: ${e.message}`));
        });
    }

    // Twitch lehnt mit 429 "websocket transports limit exceeded" ab, wenn für diesen Account (mit dieser Client-ID)
    // schon 3 WebSocket-Verbindungen offen sind (z. B. eine zweite Bot-Instanz, ein altes Programm mit derselben App).
    // twurple versucht es sonst endlos alle ~10 Sekunden erneut - nach ein paar Fehlversuchen geben wir deshalb auf.
    let failures = 0;
    if (typeof listener.onSubscriptionCreateSuccess === "function") listener.onSubscriptionCreateSuccess(() => { failures = 0; });
    if (typeof listener.onSubscriptionCreateFailure === "function") {
        listener.onSubscriptionCreateFailure((_subscription, error) => {
            const limit = error?.statusCode === 429 || /429|transports limit/i.test(String(error?.message ?? ""));
            if (!limit || ++failures < MAX_SUBSCRIBE_FAILURES) return;
            failure = "Twitch-Verbindungslimit (429): für diesen Account sind schon 3 WebSocket-Verbindungen belegt";
            logger.warn(
                `Punkte-Reward-Erfassung (EventSub) wird gestoppt: ${failure}. Läuft der Bot noch an einer anderen Stelle ` +
                    `(zweite Instanz, alter Bot, anderes Tool mit derselben Twitch-App)? Mit DIAGNOSE=true zeigt der Start, welche Sessions Twitch sieht. ` +
                    `Nach dem Beenden der anderen Verbindung: Reward-System im Dashboard aus- und wieder einschalten oder den Bot neu starten.`,
            );
            stopEventSub().catch(() => {});
        });
    }

    // Verbindungsabbrüche/Wiederverbinden der EventSub-WebSocket-Verbindung für die Fehlerliste im Dashboard
    let wsLost = false;
    if (typeof listener.onUserSocketDisconnect === "function") {
        listener.onUserSocketDisconnect((_userId, error) => {
            wsLost = true;
            logger.warn(`EventSub-WebSocket getrennt${error?.message ? `: ${error.message}` : ""}`);
        });
    }
    if (typeof listener.onUserSocketConnect === "function") {
        listener.onUserSocketConnect(() => {
            if (!wsLost) return;
            wsLost = false;
            logger.ok("EventSub-WebSocket wieder verbunden");
        });
    }

    listener.start();
    logger.info(
        `EventSub gestartet für: ${[...channelByUserId.values()].map((c) => `${c} (${[features.get(c)?.rewards && "Rewards", features.get(c)?.follow && "Follows"].filter(Boolean).join(", ")})`).join(", ")}.`,
    );
}

async function logWebsocketUsage(channel) {
    try {
        const res = await helix(channel, "/eventsub/subscriptions", { query: { first: 100 } });
        const sessions = new Map(); // session_id -> { types, newest, status }
        for (const sub of res?.data ?? []) {
            if (sub.transport?.method !== "websocket") continue;
            const id = sub.transport.session_id ?? "unbekannt";
            const entry = sessions.get(id) ?? { types: new Set(), created: sub.created_at, status: sub.status };
            entry.types.add(sub.type);
            sessions.set(id, entry);
        }
        if (!sessions.size) {
            logger.diag(`EventSub-Diagnose (${channel}): Twitch sieht aktuell keine WebSocket-Subscriptions für diesen Account.`);
            return;
        }
        const lines = [...sessions.entries()].map(
            ([id, e]) => `  Session ${id.slice(0, 8)}… seit ${e.created} (${e.status}): ${[...e.types].join(", ")}`,
        );
        logger.diag(`EventSub-Diagnose (${channel}): Twitch sieht ${sessions.size} WebSocket-Session(s) mit Subscriptions (Limit: 3 Verbindungen pro Account+Client-ID):\n${lines.join("\n")}`);
    } catch (e) {
        logger.diag(`EventSub-Diagnose (${channel}) nicht möglich: ${e.message}`);
    }
}

/** Läuft die Reward-Erfassung (EventSub) gerade? */
export const eventSubActive = () => !!listener && rewardChannelCount > 0;

/** Grund, falls die Erfassung wegen wiederholter Twitch-Fehler selbst gestoppt wurde (sonst null). */
export const eventSubFailure = () => failure;

/** Startet die Erfassung neu (z. B. nachdem im Dashboard das Reward-System ein-/ausgeschaltet wurde). */
export async function restartEventSub() {
    await stopEventSub();
    failure = null; // ein neuer Start setzt den Fehler ohnehin zurück
    await startEventSub();
}

/** Trennt die EventSub-Verbindung sauber (für einen geordneten Shutdown, siehe index.js). */
export async function stopEventSub() {
    if (!listener) return;
    try {
        await listener.stop();
        logger.info("EventSub-Verbindung getrennt.");
    } catch (e) {
        logger.warn(`EventSub-Verbindung konnte nicht sauber getrennt werden: ${e?.message ?? e}`);
    } finally {
        listener = null;
        rewardChannelCount = 0;
    }
}
