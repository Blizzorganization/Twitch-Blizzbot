/**
 * EventSub über einen CONDUIT (Twitch-"Sammelrohr"): alle Kanäle laufen über EINE WebSocket-Verbindung (Shard),
 * unabhängig von der Kanalzahl – umgeht das Limit von 3 WebSockets pro Account.
 * Einschalten mit EVENTSUB_CONDUIT=true in der .env (Standard: aus = je Kanal eine Verbindung über twurple).
 *
 * Ablauf: App-Access-Token (Client-ID + Secret) -> Conduit anlegen -> WebSocket öffnen -> bei "session_welcome" den Shard
 * des Conduits mit der Session verbinden -> Subscriptions je Kanal mit transport.method="conduit" anlegen.
 * Jeder Streamer muss die App vorher mit den nötigen Scopes autorisiert haben (Dashboard -> Benutzer).
 */
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const HELIX = "https://api.twitch.tv/helix";
const WS_URL = "wss://eventsub.wss.twitch.tv/ws";

let state = null; // { ws, conduitId, stopped, timers, handlers, entries }

async function appToken() {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: config.twitchApi.clientId, client_secret: config.twitchApi.clientSecret, grant_type: "client_credentials" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new Error(`App-Token konnte nicht geholt werden (${res.status}): ${data.message ?? "unbekannt"}`);
    return data.access_token;
}

async function helixApp(token, path, { method = "GET", body } = {}) {
    const res = await fetch(`${HELIX}${path}`, {
        method,
        headers: { "Client-Id": config.twitchApi.clientId, Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
}

/** Rohdaten von Twitch in die Form bringen, die die vorhandenen Handler (twurple-Events) erwarten. */
export function adaptEvent(type, e) {
    if (type === "channel.channel_points_custom_reward_redemption.add") {
        return {
            id: e.id,
            userName: e.user_login,
            input: e.user_input,
            rewardId: e.reward?.id,
            rewardTitle: e.reward?.title,
            rewardCost: e.reward?.cost,
            redemptionDate: new Date(e.redeemed_at),
        };
    }
    if (type === "channel.follow") return { userName: e.user_login, userDisplayName: e.user_name };
    if (type === "channel.hype_train.end") {
        return {
            id: e.id,
            level: e.level,
            total: e.total,
            topContributions: (e.top_contributions ?? []).map((c) => ({ userName: c.user_login, userDisplayName: c.user_name, total: c.total })),
        };
    }
    return e;
}

/**
 * Startet den Conduit.
 * @param {Array<{ userId: string, channel: string, rewards: boolean, follow: boolean, hype: boolean }>} entries
 * @param {{ onRedemption, onFollow, onHypeEnd }} handlers  Rückruf je Ereignis: (channel, adaptiertesEvent)
 */
export async function startConduit(entries, handlers, skipped = new Map()) {
    await stopConduit();
    const s = { ws: null, conduitId: null, stopped: false, timers: {}, handlers, entries, skipped, token: null, attempt: 0, connected: false };
    state = s;
    s.token = await appToken();

    // Alte Conduits dieser App entfernen (der Bot ist der einzige Nutzer) und einen frischen mit einem Shard anlegen
    const list = await helixApp(s.token, "/eventsub/conduits");
    for (const c of list.data?.data ?? []) await helixApp(s.token, `/eventsub/conduits?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
    const created = await helixApp(s.token, "/eventsub/conduits", { method: "POST", body: { shard_count: 1 } });
    s.conduitId = created.data?.data?.[0]?.id;
    if (!created.ok || !s.conduitId) throw new Error(`Conduit konnte nicht angelegt werden (${created.status}): ${created.data?.message ?? "unbekannt"}`);

    connect(s, WS_URL);
    return s.conduitId;
}

function connect(s, url) {
    if (s.stopped) return;
    const ws = new WebSocket(url);
    s.ws = ws;
    ws.onmessage = (ev) => onMessage(s, ws, ev.data).catch((e) => logger.warn(`EventSub (Conduit): Nachricht nicht verarbeitet: ${e.message}`));
    ws.onclose = () => {
        if (s.ws !== ws) return;
        s.connected = false;
        clearTimeout(s.timers.keepalive);
        if (s.stopped) return;
        const wait = Math.min(30_000, 1000 * 2 ** Math.min(s.attempt++, 5));
        logger.warn(`EventSub (Conduit): Verbindung getrennt, verbinde neu (in ${Math.round(wait / 1000)} s).`);
        s.timers.reconnect = setTimeout(() => connect(s, WS_URL), wait);
    };
    ws.onerror = () => {}; // das folgende close-Ereignis kümmert sich um das Wiederverbinden
}

async function onMessage(s, ws, raw) {
    if (s.ws !== ws || s.stopped) return;
    const msg = JSON.parse(String(raw));
    const type = msg.metadata?.message_type;
    if (type === "session_welcome") {
        const sessionId = msg.payload.session.id;
        const timeout = (msg.payload.session.keepalive_timeout_seconds ?? 10) + 5;
        s.keepaliveMs = timeout * 1000;
        armKeepalive(s, ws);
        const r = await helixApp(s.token, "/eventsub/conduits/shards", {
            method: "PATCH",
            body: { conduit_id: s.conduitId, shards: [{ id: "0", transport: { method: "websocket", session_id: sessionId } }] },
        });
        if (!r.ok || r.data?.errors?.length) throw new Error(`Shard konnte nicht verbunden werden (${r.status}): ${r.data?.message ?? JSON.stringify(r.data?.errors)}`);
        s.attempt = 0;
        const firstTime = !s.subscribed;
        s.connected = true;
        if (firstTime) {
            s.subscribed = true;
            await subscribeAll(s);
        }
        if (!firstTime) logger.ok("EventSub (Conduit): wieder verbunden");
        else {
            logger.ok(`EventSub (Conduit) verbunden für: ${s.entries.map((x) => x.channel).join(", ")} (eine Verbindung für alle).`);
            // Kanäle, die nicht dabei sind, ausdrücklich nennen (sonst sieht "verbunden" nach "alles läuft" aus)
            if (s.skipped.size) logger.warn(`EventSub (Conduit): NICHT dabei: ${[...s.skipped].map(([ch, why]) => `${ch} (${why})`).join(", ")}`);
        }
        return;
    }
    armKeepalive(s, ws);
    if (type === "session_reconnect") {
        ws.close(); // neu verbinden; beim nächsten "session_welcome" wird der Shard neu verknüpft
        return;
    }
    if (type === "revocation") {
        logger.warn(`EventSub (Conduit): Twitch hat eine Subscription widerrufen (${msg.payload?.subscription?.type}, Grund: ${msg.payload?.subscription?.status}).`);
        return;
    }
    if (type !== "notification") return;
    const sub = msg.payload.subscription;
    const e = msg.payload.event;
    const entry = s.entries.find((x) => x.userId === String(e.broadcaster_user_id));
    if (!entry) return;
    const ev = adaptEvent(sub.type, e);
    if (sub.type === "channel.channel_points_custom_reward_redemption.add") s.handlers.onRedemption(entry.channel, ev);
    else if (sub.type === "channel.follow") s.handlers.onFollow(entry.channel, ev);
    else if (sub.type === "channel.hype_train.end") s.handlers.onHypeEnd(entry.channel, ev);
}

function armKeepalive(s, ws) {
    clearTimeout(s.timers.keepalive);
    s.timers.keepalive = setTimeout(() => {
        logger.warn("EventSub (Conduit): keine Lebenszeichen von Twitch – Verbindung wird neu aufgebaut.");
        try { ws.close(); } catch { /* ignorieren */ }
    }, s.keepaliveMs ?? 15_000);
}

async function subscribeAll(s) {
    const transport = { method: "conduit", conduit_id: s.conduitId };
    for (const e of s.entries) {
        const wanted = [];
        if (e.rewards) wanted.push(["channel.channel_points_custom_reward_redemption.add", "1", { broadcaster_user_id: e.userId }]);
        if (e.follow) wanted.push(["channel.follow", "2", { broadcaster_user_id: e.userId, moderator_user_id: e.userId }]);
        if (e.hype) wanted.push(["channel.hype_train.end", "2", { broadcaster_user_id: e.userId }]);
        for (const [type, version, condition] of wanted) {
            const r = await helixApp(s.token, "/eventsub/subscriptions", { method: "POST", body: { type, version, condition, transport } });
            if (r.ok || r.status === 409) continue; // 409 = gibt es schon
            const hint = r.status === 403 ? " – hat der Streamer die App mit dem nötigen Scope autorisiert? (Dashboard → Benutzer → Anwendung autorisieren)" : "";
            logger.warn(`EventSub (Conduit): Subscription ${type} für ${e.channel} fehlgeschlagen (${r.status}): ${r.data?.message ?? "unbekannt"}${hint}`);
        }
    }
}

export const conduitActive = () => !!state && !state.stopped && state.connected;
export const conduitRunning = () => !!state && !state.stopped;

export async function stopConduit() {
    const s = state;
    if (!s) return;
    s.stopped = true;
    state = null;
    Object.values(s.timers).forEach(clearTimeout);
    try { s.ws?.close(); } catch { /* ignorieren */ }
    if (s.conduitId && s.token) {
        try { await helixApp(s.token, `/eventsub/conduits?id=${encodeURIComponent(s.conduitId)}`, { method: "DELETE" }); } catch { /* ignorieren */ }
    }
}
