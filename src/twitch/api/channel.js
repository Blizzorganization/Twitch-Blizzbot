import { broadcasterId, helix, moderatorId } from "./client.js";
import { cleanChannel } from "../../db/init.js";

/** Kanal-Abfragen und -Änderungen: Spiel/Titel, Nutzer, Stream, Follower, Subs, Emotes, Chatters. */

/** Sucht eine Kategorie: exakter Treffer (ohne Groß-/Kleinschreibung) bevorzugt, sonst bester Treffer. */
export async function searchCategory(channel, name) {
    const data = await helix(channel, "/search/categories", { query: { query: name, first: "10" } });
    const list = data?.data ?? [];
    if (!list.length) return null;
    return list.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? list[0];
}

export async function setGame(channel, name) {
    const category = await searchCategory(channel, name);
    if (!category) return null;
    const id = await broadcasterId(channel);
    await helix(channel, "/channels", { method: "PATCH", query: { broadcaster_id: id }, body: { game_id: category.id } });
    return category.name;
}

export const MAX_TITLE_LENGTH = 140;

export async function setTitle(channel, title) {
    if (title.length > MAX_TITLE_LENGTH) throw new Error(`Der Titel ist zu lang (${title.length}/${MAX_TITLE_LENGTH} Zeichen).`);
    const id = await broadcasterId(channel);
    await helix(channel, "/channels", { method: "PATCH", query: { broadcaster_id: id }, body: { title } });
}

/** Nutzerdaten per Login-Name (null, wenn es den Nutzer nicht gibt). */
export async function getUser(channel, login) {
    const data = await helix(channel, "/users", { query: { login: login.toLowerCase() } });
    return data?.data?.[0] ?? null;
}

/** Laufender Stream oder null, wenn der Kanal offline ist. */
export async function getStream(channel) {
    const data = await helix(channel, "/streams", { query: { user_login: cleanChannel(channel) } });
    return data?.data?.[0] ?? null;
}

/** Titel und Kategorie (auch offline). */
export async function getChannelInfo(channel) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/channels", { query: { broadcaster_id: id } });
    return data?.data?.[0] ?? null;
}

/** Zeitpunkt des Folgens (ISO-String) oder null, wenn der Nutzer nicht folgt. */
export async function getFollowedAt(channel, userId) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/channels/followers", { query: { broadcaster_id: id, user_id: userId } });
    return data?.data?.[0]?.followed_at ?? null;
}

export async function getFollowerCount(channel) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/channels/followers", { query: { broadcaster_id: id, first: "1" } });
    return data?.total ?? 0;
}

/** { total, points } – braucht den Scope channel:read:subscriptions */
export async function getSubscriberInfo(channel) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/subscriptions", { query: { broadcaster_id: id, first: "1" } });
    return { total: data?.total ?? 0, points: data?.points ?? 0 };
}

export async function getTwitchEmotes(channel) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/chat/emotes", { query: { broadcaster_id: id } });
    return (data?.data ?? []).map((e) => e.name);
}

/** BetterTTV-Emotes des Kanals (öffentliche BTTV-API, kein Twitch-Token nötig). */
export async function getBttvEmotes(channel) {
    const id = await broadcasterId(channel);
    const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${id}`);
    if (!res.ok) return [];
    const data = await res.json();
    return [...(data.channelEmotes ?? []), ...(data.sharedEmotes ?? [])].map((e) => e.code);
}

/** 7TV-Emotes des Kanals (öffentliche 7TV-API v3, kein Twitch-Token nötig). */
export async function getSevenTvEmotes(channel) {
    const id = await broadcasterId(channel);
    const res = await fetch(`https://7tv.io/v3/users/twitch/${id}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.emote_set?.emotes ?? []).map((e) => e.name);
}

/** Alle Nutzer im Chat (Login-Namen) – braucht moderator:read:chatters */
export async function getChatters(channel) {
    const id = await broadcasterId(channel);
    const mod = await moderatorId(channel);
    const names = [];
    let cursor;
    do {
        const data = await helix(channel, "/chat/chatters", {
            query: { broadcaster_id: id, moderator_id: mod, first: "1000", ...(cursor ? { after: cursor } : {}) },
        });
        for (const c of data?.data ?? []) names.push(c.user_login);
        cursor = data?.pagination?.cursor;
    } while (cursor);
    return names;
}
