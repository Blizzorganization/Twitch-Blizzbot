import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .env liegt im configs/-Ordner (zusammen mit automessages.json, links.txt, TLDs.txt, mods.txt),
// nicht mehr im Projekt-Root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../configs/.env") });

function required(name, fallback = undefined) {
    const val = process.env[name] ?? fallback;
    return val;
}

const list = (v) => (v || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const num = (name, fallback) => {
    const n = Number(process.env[name]);
    return process.env[name] === undefined || process.env[name] === "" || Number.isNaN(n) ? fallback : n;
};
const bool = (name, fallback) => {
    const v = process.env[name];
    return v === undefined || v === "" ? fallback : v === "true";
};
/** Kanalname normalisiert wie überall sonst im Bot: ohne führendes "#", klein geschrieben, getrimmt. */
const cleanChannelName = (c) => String(c ?? "").trim().replace(/^#+/, "").toLowerCase();

export const config = {
    twitch: {
        username: required("TWITCH_BOT_USERNAME"),
        oauthToken: required("TWITCH_OAUTH_TOKEN"), // "oauth:xxxxxxx" (altes Format, wird für die Chat-Verbindung als Fallback genutzt)
        channels: (required("TWITCH_CHANNELS", "") || "")
            .split(",")
            .map(cleanChannelName)
            .filter(Boolean),
        // Chat-Verbindung (twurple statt tmi.js): Client-ID der App, die den Bot-Account-Token ausgestellt hat
        // (Standard: dieselbe App wie TWITCH_CLIENT_ID, falls der Token über dieselbe App erzeugt wurde).
        chatAuth: {
            clientId: required("TWITCH_BOT_CLIENT_ID") || required("TWITCH_CLIENT_ID"),
            clientSecret: required("TWITCH_BOT_CLIENT_SECRET") || required("TWITCH_CLIENT_SECRET"),
            // Reiner Access-Token ohne "oauth:"-Präfix. Fällt auf TWITCH_OAUTH_TOKEN zurück, falls nicht gesetzt.
            accessToken: (required("TWITCH_BOT_ACCESS_TOKEN", "") || required("TWITCH_OAUTH_TOKEN", "") || "").replace(/^oauth:/, ""),
            // Optional: Refresh-Token für den Bot-Account -> automatische Token-Erneuerung (RefreshingAuthProvider).
            // Ohne Refresh-Token wird der Access-Token unverändert verwendet (wie zuvor bei tmi.js).
            refreshToken: required("TWITCH_BOT_REFRESH_TOKEN"),
        },
    },
    // Twitch Helix API: nur die App-Zugangsdaten. Die Tokens werden im Dashboard autorisiert und liegen in der Datenbank.
    twitchApi: {
        clientId: required("TWITCH_CLIENT_ID"),
        clientSecret: required("TWITCH_CLIENT_SECRET"),
    },
    discord: {
        enabled: required("DISCORD_ENABLED", "false") === "true",
        token: required("DISCORD_TOKEN"),
        clientId: required("DISCORD_CLIENT_ID"),
        // Server(e), auf denen die Verwaltungs-Commands (/add /edit /del ...) registriert werden. Komma-getrennt für mehrere Server.
        guildIds: (required("DISCORD_GUILD_ID", "") || "").split(",").map((s) => s.trim()).filter(Boolean),
        // Optional: eigene(r) Server für die Nutzer-Commands (/watchtime /link /unlink /info), falls diese auf
        // einem ANDEREN Discord-Server laufen sollen als die Verwaltungs-Commands. Ohne Angabe: dieselben Server wie DISCORD_GUILD_ID.
        publicGuildIds: (required("DISCORD_PUBLIC_GUILD_ID", "") || "").split(",").map((s) => s.trim()).filter(Boolean),
        adminRoleId: required("DISCORD_ADMIN_ROLE_ID"),
        // Twitch-Kanal für alle Discord-Funktionen (Verwaltung, "say", /watchtime usw.).
        // Ohne Angabe: der erste Kanal aus TWITCH_CHANNELS.
        twitchChannel:
            cleanChannelName(required("DISCORD_TWITCH_CHANNEL")) ||
            (required("TWITCH_CHANNELS", "") || "").split(",").map(cleanChannelName).filter(Boolean)[0],
        // Discord-Kanal, in den !blacklist (Twitch) die Blacklist schickt (wie im alten Bot)
        blacklistChannelId: required("DISCORD_BLACKLIST_CHANNEL_ID"),
        // "say"-Funktion wie im alten Bot: Nachrichten in diesem Discord-Kanal werden 1:1 in den Twitch-Chat gepostet
        sayChannelId: required("DISCORD_SAY_CHANNEL_ID"),
        get sayTwitchChannel() {
            return cleanChannelName(required("DISCORD_SAY_TWITCH_CHANNEL")) || this.twitchChannel;
        },
        // Gemeinsame Farbe für ALLE Discord-Embeds (Hex, z. B. "#edbc5d" oder "edbc5d"). Ohne Angabe: der bisherige Standard.
        get embedColor() {
            const hex = (required("DISCORD_EMBED_COLOR", "") || "").replace(/^#/, "");
            const n = parseInt(hex, 16);
            return hex && !Number.isNaN(n) ? n : 0xedbc5d;
        },
    },
    db: {
        host: required("PGHOST", "localhost"),
        port: Number(required("PGPORT", "5432")),
        user: required("PGUSER", "postgres"),
        password: required("PGPASSWORD", "postgres"),
        database: required("PGDATABASE", "blizzbot"),
    },
    web: {
        enabled: required("WEB_ENABLED", "true") === "true",
        port: Number(required("WEB_PORT", "3080")),
        // Reine Notfall-/Erstzugangs-Anmeldung. Für den täglichen Gebrauch bitte einen Nutzer anlegen (Tab "Benutzer").
        adminToken: required("WEB_ADMIN_TOKEN", ""),
        // Nur nötig, wenn das Dashboard von einer ANDEREN Adresse als der des Bots aufgerufen wird (z. B. der Vite-Dev-Server).
        // Leer = kein CORS (Standard, das Dashboard wird vom Bot selbst ausgeliefert).
        corsOrigin: required("WEB_CORS_ORIGIN", ""),
        // Steht ein Reverse-Proxy (nginx, Caddy, Cloudflare ...) vor dem Bot: "true" (oder Anzahl der Proxys), damit die echte
        // Besucher-IP für die Anmelde-Begrenzung genutzt wird. Ohne Proxy leer lassen.
        trustProxy: (() => { const v = (process.env.WEB_TRUST_PROXY ?? "").trim(); return v === "" || v === "false" ? false : v === "true" ? true : Number.isInteger(Number(v)) ? Number(v) : v; })(),
        // Signiert die Login-Tokens der Nutzer. Unbedingt auf einen eigenen, zufälligen Wert setzen!
        jwtSecret: required("WEB_JWT_SECRET", ""),
        // Öffentlich erreichbare Basis-URL des Dashboards (ohne abschließenden "/"), z. B. "https://bot.example.com".
        // Wird für die Twitch-Autorisierung (Tab "Benutzer") als Redirect-URI gebraucht - MUSS exakt so (inkl.
        // "/api/auth/twitch/callback") in der eigenen App unter https://dev.twitch.tv/console als "OAuth Redirect URL"
        // eingetragen werden. Ohne Angabe wird die Basis-URL aus dem eingehenden Request abgeleitet (funktioniert
        // meist auch, kann aber z. B. hinter einem Reverse-Proxy das falsche Protokoll (http statt https) liefern).
        publicUrl: (required("WEB_PUBLIC_URL", "") || "").replace(/\/+$/, ""),
    },
    bot: {
        // Twitch-Namen mit Dev-Rechten (Stufe 10), Komma getrennt
        devs: list(required("TWITCH_DEVS")),
        // Wenn true: nur Namen aus configs/mods.txt gelten als Mods
        permit: bool("TWITCH_PERMIT", false),
        // prefix for chat commands, e.g. "!"
        prefix: required("COMMAND_PREFIX", "!"),
        // Standard-Cooldown (Sekunden) für neue Custom Commands
        defaultCooldown: Number(required("DEFAULT_COOLDOWN_SECONDS", "5")),
        // Standardwerte für die Kanal-Einstellungen. Sie lassen sich je Kanal im Dashboard ändern
        // (Einstellungen, Moderation, Loyalty System ...) und stehen bewusst nicht in der .env.
        cooldown: 0,
        raidMinutes: 5,
        raidMinViewers: 0,
        followModeMinutes: 5,
        greetingsEnabled: true,
        botModsOnly: false,
        followAlertMax: 6,
        followAlertWindowSeconds: 60,
        automessageDelay: 0,
        automessageOnlyLive: true,
        automessageMinViewers: 0,
        automessageMinChatMessages: 0,
        watchtimeEnabled: true,
        blacklistEnabled: true,
        timersEnabled: true,
        linkFilter: true,
        deleteActionMessages: true,
        giveawayRepeatMinutes: 5,
        levelingEnabled: true,
        xpPerMessage: 5,
        messageXpCooldownSeconds: 60,
        xpPerWatchMinute: 10,
        pointsEnabled: true,
        pointsPerWatchMinute: 5,
        pointsPerMessage: 1,
        messagePointsCooldownSeconds: 60,
    },
};

/** Rechtestufen wie im alten Blizzbot (modules/constants.js) */
export const PERMISSIONS = {
    EVERYONE: 0,
    SUBSCRIBER: 1,
    VIP: 2,
    MODERATOR: 3,
    BROADCASTER: 5,
    DEV: 10,
};

export const PERMISSION_NAMES = {
    0: "everyone",
    1: "subscriber",
    2: "vip",
    3: "moderator",
    5: "broadcaster",
    10: "dev",
};

export function permissionFromName(name) {
    if (name === undefined || name === null || name === "") return PERMISSIONS.EVERYONE;
    if (typeof name === "number") return name;
    const key = String(name).trim().toLowerCase();
    if (/^\d+$/.test(key)) return Number(key);
    // Kurzformen wie im alten Bot
    const short = { user: 0, sub: 1, mod: 3, streamer: 5 };
    if (key in short) return short[key];
    const entry = Object.entries(PERMISSION_NAMES).find(([, v]) => v === key);
    return entry ? Number(entry[0]) : PERMISSIONS.EVERYONE;
}

/** Blacklist-Aktionen wie im alten Bot: 0 = löschen, 1-9 = Timeout (Sekunden), 10 = Bann */
export const BLACKLIST_TIMEOUTS = { 1: 10, 2: 30, 3: 42, 4: 60, 5: 300, 6: 600, 7: 1200, 8: 1800, 9: 3600 };
export const BLACKLIST_BAN = 10;
