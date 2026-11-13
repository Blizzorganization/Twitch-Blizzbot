// Login nur pro Browser-Tab (sessionStorage): Tab/Fenster schließen = automatisch abgemeldet, ein Neuladen der Seite behält die Anmeldung.
// Alte, dauerhaft gespeicherte Anmeldungen (früher localStorage) werden entfernt.
for (const k of ["adminToken", "username", "isAdmin", "isOwner", "userId"]) localStorage.removeItem(k);

// Twitch-Autorisierung: Am Handy öffnet sich die Rückleitung oft in einem neuen Tab/Browser-Fenster (ohne sessionStorage).
// Deshalb wird die Anmeldung unmittelbar vor dem Twitch-Login kurz (10 Min.) abgelegt und nach der Rückleitung
// (URL enthält ?twitchAuth=) einmalig wiederhergestellt und sofort gelöscht.
const AUTH_STASH = "twitchAuthStash";
try {
    const params = new URLSearchParams(window.location.search);
    const stash = JSON.parse(localStorage.getItem(AUTH_STASH) ?? "null");
    localStorage.removeItem(AUTH_STASH);
    if (params.has("twitchAuth") && !sessionStorage.getItem("adminToken") && stash && Date.now() - stash.at < 10 * 60_000) {
        for (const [k, v] of Object.entries(stash.session)) sessionStorage.setItem(k, v);
    }
} catch { /* Storage nicht verfügbar - dann eben neu anmelden */ }

let token = sessionStorage.getItem("adminToken") ?? "";
let username = sessionStorage.getItem("username") ?? "";
let isAdmin = sessionStorage.getItem("isAdmin") === "true";
let isOwner = sessionStorage.getItem("isOwner") === "true";
let userId = Number(sessionStorage.getItem("userId") ?? "0");

export const getToken = () => token;
export const getUsername = () => username;
export const getIsAdmin = () => isAdmin;
export const getIsOwner = () => isOwner;
export const getUserId = () => userId;

export function setSession(t, u = "", admin = false, id = 0, owner = false) {
    token = t;
    username = u;
    isAdmin = admin;
    isOwner = owner;
    userId = id;
    sessionStorage.setItem("adminToken", t);
    sessionStorage.setItem("username", u);
    sessionStorage.setItem("isAdmin", String(admin));
    sessionStorage.setItem("isOwner", String(owner));
    sessionStorage.setItem("userId", String(id));
}
export function clearSession() {
    setSession("", "", false, 0, false);
}

// Kleine Rückmeldungen ("Gespeichert", "Gelöscht" ...), die das Dashboard als Hinweis einblendet.
const toastListeners = new Set();
export function onToast(fn) {
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
}
export function toast(message, type = "ok") {
    for (const fn of toastListeners) fn({ message, type });
}

/**
 * Anfrage an die Dashboard-API. Nach erfolgreichem Speichern (PUT) bzw. Löschen (DELETE) erscheint automatisch eine
 * kurze Rückmeldung; mit `toast: "Text"` lässt sich eine eigene Meldung setzen (z. B. für POST-Aktionen), mit `toast: false` keine.
 */
export async function api(path, { method = "GET", body, channel, skipAuth = false, toast: toastText } = {}) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `/api${path}${channel ? sep + "channel=" + encodeURIComponent(channel) : ""}`;
    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(skipAuth ? {} : { Authorization: `Bearer ${token}` }) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? data.result ?? `Fehler ${res.status}`);
    if (!skipAuth && toastText !== false) {
        const text = toastText ?? (method === "PUT" ? "Gespeichert" : method === "DELETE" ? "Gelöscht" : null);
        if (text) toast(text);
    }
    return data;
}

export const authStatus = () => api("/auth/status", { skipAuth: true });
export const login = (u, p) => api("/auth/login", { method: "POST", skipAuth: true, body: { username: u, password: p } });
export const setup = (u, p, setupToken) => api("/auth/setup", { method: "POST", skipAuth: true, body: { username: u, password: p, setupToken } });
export const me = () => api("/me");

/** Legt die Anmeldung kurz ab, damit sie die Twitch-Rückleitung auch in einem neuen Tab überlebt (siehe oben). */
export function stashSessionForAuth() {
    try {
        const session = {};
        for (const k of ["adminToken", "username", "isAdmin", "isOwner", "userId"]) session[k] = sessionStorage.getItem(k) ?? "";
        localStorage.setItem(AUTH_STASH, JSON.stringify({ at: Date.now(), session }));
    } catch { /* ignorieren */ }
}
