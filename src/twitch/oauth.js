import { config } from "../config.js";

const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

/**
 * Vollständige Scope-Liste für den API-Token (siehe configs/example.env), damit eine (Neu-)Autorisierung
 * über den Dashboard-Button KEINE bestehende Funktion verliert, die vorher per Token-Generator eingerichtet war.
 */
export const SCOPES = [
    "channel:manage:broadcast",
    "moderator:manage:chat_settings",
    "moderator:manage:banned_users",
    "moderator:manage:chat_messages",
    "moderator:read:followers",
    "moderator:read:chatters",
    "channel:read:subscriptions",
    "channel:manage:polls",
    "channel:read:polls",
    "channel:manage:predictions",
    "channel:read:predictions",
    "moderator:manage:shoutouts",
    "channel:manage:redemptions",
    "channel:read:redemptions",
    "channel:read:hype_train", // Hype-Train-Zusammenfassung (EventSub)
    // für die Erfassung von Moderator-Aktionen (EventSub "channel.moderate", siehe modlog.js)
    "moderator:read:blocked_terms",
    "moderator:read:unban_requests",
    "moderator:read:warnings",
    "moderator:read:moderators",
    "moderator:read:vips",
];

/** Scopes des Bot-Accounts (Moderator): Löschen, Timeout/Ban, Follower-Modus + Lesen für die Moderator-Statistik. */
export const BOT_SCOPES = [
    "moderator:manage:shoutouts",
    "moderator:manage:chat_settings",
    "moderator:manage:banned_users",
    "moderator:manage:chat_messages",
    "moderator:read:blocked_terms",
    "moderator:read:unban_requests",
    "moderator:read:warnings",
    "moderator:read:moderators",
    "moderator:read:vips",
];

/** Baut die Twitch-Autorisierungs-URL, zu der der Nutzer weitergeleitet wird. */
export function buildAuthorizeUrl(redirectUri, state, scopes = SCOPES) {
    const params = new URLSearchParams({
        client_id: config.twitchApi.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        // Erzwingt den Login-/Zustimmungs-Screen, auch wenn im Browser noch eine Twitch-Session eines
        // ANDEREN Accounts (z. B. des Bot-Accounts) eingeloggt ist - sonst würde ggf. der falsche Account autorisiert.
        force_verify: "true",
    });
    return `${AUTHORIZE_URL}?${params}`;
}

/** Tauscht den Autorisierungs-Code gegen Access-/Refresh-Token ein. */
export async function exchangeCode(code, redirectUri) {
    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: config.twitchApi.clientId,
            client_secret: config.twitchApi.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? `Token-Austausch fehlgeschlagen (${res.status})`);
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
}
