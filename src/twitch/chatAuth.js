import { StaticAuthProvider, RefreshingAuthProvider } from "@twurple/auth";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { pool } from "../db/pool.js";

// Eigener Schlüssel in der (schon vorhandenen) Tabelle twitch_tokens, damit der Chat-Bot-Account-Token
// getrennt von den Broadcaster-API-Tokens (je Kanal) gespeichert wird. Kein Schema-Update nötig.
const BOT_TOKEN_KEY = "__bot_chat__";

async function loadStoredBotToken() {
    const { rows } = await pool.query(`SELECT access_token, refresh_token FROM twitch_tokens WHERE channel = $1;`, [BOT_TOKEN_KEY]);
    return rows[0] ? { accessToken: rows[0].access_token, refreshToken: rows[0].refresh_token } : null;
}

async function saveBotToken(token) {
    await pool.query(
        `INSERT INTO twitch_tokens (channel, access_token, refresh_token) VALUES ($1, $2, $3)
         ON CONFLICT (channel) DO UPDATE SET access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token, updated_at = now();`,
        [BOT_TOKEN_KEY, token.accessToken, token.refreshToken ?? null],
    );
}

/** Ermittelt die Twitch-User-ID des Bot-Accounts über Helix (nötig für RefreshingAuthProvider.addUser). */
async function fetchBotUserId(clientId, accessToken) {
    const res = await fetch("https://api.twitch.tv/helix/users", {
        headers: { "Client-Id": clientId, Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.data?.[0]?.id) {
        throw new Error(`Bot-User-ID konnte nicht ermittelt werden (Client-ID/Token des Bot-Accounts prüfen): ${data?.message ?? res.status}`);
    }
    return data.data[0].id;
}

/** Erklärt einen Netzwerkfehler von fetch() verständlich ("fetch failed" allein sagt nichts; der Grund steckt in e.cause). */
export function describeNetworkError(e) {
    const code = e?.cause?.code ?? e?.code;
    const hints = {
        ENOTFOUND: "Der Name id.twitch.tv lässt sich nicht auflösen (DNS/Internet/VPN prüfen).",
        EAI_AGAIN: "DNS antwortet nicht (Internet/VPN prüfen).",
        ETIMEDOUT: "Zeitüberschreitung beim Verbinden (Firewall, Antivirus, VPN oder IPv6-Problem?).",
        UND_ERR_CONNECT_TIMEOUT: "Zeitüberschreitung beim Verbinden (Firewall, Antivirus, VPN oder IPv6-Problem?).",
        ECONNREFUSED: "Verbindung wurde abgelehnt (Firewall/Proxy?).",
        ECONNRESET: "Verbindung wurde zurückgesetzt (Firewall, Antivirus oder instabiles Netz?).",
        CERT_HAS_EXPIRED: "Zertifikatsproblem (Uhrzeit des PCs oder Antivirus/Proxy mit eigener Zertifikatsprüfung?).",
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Zertifikatsproblem (Antivirus/Proxy mit eigener Zertifikatsprüfung?).",
    };
    return `${e?.message ?? e}${code ? ` [${code}]` : ""}${hints[code] ? ` – ${hints[code]}` : ""}`;
}

/**
 * Prüft vor dem Start, ob Twitch (id.twitch.tv) erreichbar ist. Eine 401-Antwort reicht - sie beweist, dass die
 * Verbindung steht. Bei Netzfehlern gibt es ein paar Versuche; danach bricht der Start mit einer klaren Meldung ab,
 * statt twurple mit "No valid token available / fetch failed" ins Leere laufen zu lassen.
 */
export async function ensureTwitchReachable(attempts = 4, delayMs = 3000) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            await fetch("https://id.twitch.tv/oauth2/validate", { signal: AbortSignal.timeout(10_000) });
            return;
        } catch (e) {
            lastError = e;
            logger.warn(`Twitch (id.twitch.tv) nicht erreichbar, Versuch ${i}/${attempts}: ${describeNetworkError(e)}`);
            if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw new Error(`Twitch ist von diesem Rechner aus nicht erreichbar: ${describeNetworkError(lastError)}`);
}

/**
 * Baut den Auth-Provider für die Chat-Verbindung (ersetzt tmi.js' identity-Objekt).
 *  - Ohne TWITCH_BOT_REFRESH_TOKEN: StaticAuthProvider (wie bisher bei tmi.js -> kein Auto-Refresh,
 *    der Token muss die Scopes chat:read + chat:edit haben und darf nicht abgelaufen sein).
 *  - Mit TWITCH_BOT_REFRESH_TOKEN (+ Client-Secret): RefreshingAuthProvider, der abgelaufene Tokens
 *    automatisch erneuert und in der Tabelle twitch_tokens (Schlüssel "__bot_chat__") sichert.
 */
export async function createChatAuthProvider() {
    const { clientId, clientSecret, accessToken, refreshToken } = config.twitch.chatAuth;
    if (!clientId || !accessToken) {
        throw new Error(
            "Für die Chat-Verbindung fehlen Zugangsdaten: TWITCH_CLIENT_ID (oder TWITCH_BOT_CLIENT_ID) und " +
                "TWITCH_OAUTH_TOKEN/TWITCH_BOT_ACCESS_TOKEN müssen gesetzt sein.",
        );
    }

    if (!refreshToken || !clientSecret) {
        logger.info("Chat-Verbindung nutzt einen statischen Token (kein TWITCH_BOT_REFRESH_TOKEN gesetzt, kein Auto-Refresh).");
        return new StaticAuthProvider(clientId, accessToken, ["chat:read", "chat:edit"]);
    }

    const provider = new RefreshingAuthProvider({ clientId, clientSecret });
    provider.onRefresh((_userId, token) => {
        saveBotToken(token).catch((e) => logger.error("Bot-Chat-Token konnte nicht gespeichert werden:", e));
    });

    const stored = await loadStoredBotToken();
    const initial = {
        accessToken: stored?.accessToken ?? accessToken,
        refreshToken: stored?.refreshToken ?? refreshToken,
        expiresIn: null,
        obtainmentTimestamp: 0,
        scope: ["chat:read", "chat:edit"],
    };
    await ensureTwitchReachable();
    const userId = await fetchBotUserId(clientId, initial.accessToken);
    await provider.addUser(userId, initial, ["chat"]);
    logger.info("Chat-Verbindung nutzt RefreshingAuthProvider (automatische Token-Erneuerung aktiv).");
    return provider;
}
