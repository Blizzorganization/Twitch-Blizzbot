import { BOT_KEY, apiConfigured, ensureFreshToken, getBotIdentity, idCache, refresh } from "./tokens.js";
import { cleanChannel } from "../../db/init.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";

/** Helix-Grundbausteine: Request mit Token (inkl. Refresh), Broadcaster-/Moderator-ID und der Moderations-Request mit Bot-Account. */

const HELIX = "https://api.twitch.tv/helix";

/** Helix-Request mit Bearer-Token; erneuert das Token proaktiv vor Ablauf und zusätzlich einmal bei 401. */
export async function helix(channel, path, { method = "GET", query, body, as } = {}) {
    // as: "bot" = mit dem Token des Bot-Accounts statt dem des Kanal-Besitzers
    channel = as === "bot" ? BOT_KEY : cleanChannel(channel);
    if (!apiConfigured()) throw new Error("Twitch-API ist nicht konfiguriert (TWITCH_CLIENT_ID und TWITCH_CLIENT_SECRET in configs/.env).");
    const url = `${HELIX}${path}${query ? "?" + new URLSearchParams(query) : ""}`;

    const call = async (access) =>
        fetch(url, {
            method,
            headers: {
                "Client-Id": config.twitchApi.clientId,
                Authorization: `Bearer ${access}`,
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });

    let t = await ensureFreshToken(channel);
    let res = t.access ? await call(t.access) : null;
    if (!res || res.status === 401) {
        // Fallback, falls die Gültigkeit unbekannt war (z. B. direkt nach dem Start mit dem .env-Token) oder
        // das Token aus einem anderen Grund vorzeitig ungültig wurde.
        // Hat ein paralleler Request den Token inzwischen schon erneuert, reicht ein neuer Versuch mit dem aktuellen -
        // ein zweiter Refresh wäre überflüssig und würde den frisch ausgestellten Token sofort wieder verwerfen.
        t = await refresh(channel, t.access);
        res = await call(t.access);
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message ?? `Twitch-API Fehler ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

const warnedModFallback = new Set();

/**
 * Moderations-Request: bevorzugt mit dem Bot-Account (der dann als Moderator in Twitchs Log steht).
 * Ist keiner autorisiert oder ist er in diesem Kanal kein Moderator (401/403), wird mit dem Token des
 * Kanal-Besitzers wiederholt, damit die Moderation nie ganz ausfällt.
 */
export async function modHelix(channel, path, { query = {}, broadcasterParam = "broadcaster_id", ...opts } = {}) {
    const broadcaster_id = await broadcasterId(channel);
    const bot = await getBotIdentity();
    if (bot) {
        try {
            return await helix(channel, path, { ...opts, as: "bot", query: { ...query, [broadcasterParam]: broadcaster_id, moderator_id: bot.id } });
        } catch (e) {
            const retry = e.status === 401 || e.status === 403 || (e.status === 400 && /moderator/i.test(e.message));
            if (!retry) throw e;
            const key = `${channel}:${e.message}`;
            if (!warnedModFallback.has(key)) {
                warnedModFallback.add(key);
                logger.warn(`Moderation über den Bot-Account in ${channel} nicht möglich (${e.message}) - weiche auf den Kanal-Token aus. Ist der Bot dort Moderator und autorisiert?`);
            }
        }
    }
    return helix(channel, path, { ...opts, query: { ...query, [broadcasterParam]: broadcaster_id, moderator_id: await moderatorId(channel) } });
}

export async function broadcasterId(channel) {
    channel = cleanChannel(channel);
    if (idCache.has(channel)) return idCache.get(channel);
    const data = await helix(channel, "/users", { query: { login: channel } });
    const id = data?.data?.[0]?.id;
    if (!id) throw new Error(`Kanal "${channel}" nicht gefunden.`);
    idCache.set(channel, id);
    return id;
}

const selfIds = new Map(); // channel -> user_id des Token-Besitzers (= moderator_id)

export async function moderatorId(channel) {
    channel = cleanChannel(channel);
    if (selfIds.has(channel)) return selfIds.get(channel);
    const data = await helix(channel, "/users"); // ohne Parameter: Besitzer des Tokens
    const id = data?.data?.[0]?.id;
    if (!id) throw new Error("Token-Besitzer konnte nicht ermittelt werden.");
    selfIds.set(channel, id);
    return id;
}
