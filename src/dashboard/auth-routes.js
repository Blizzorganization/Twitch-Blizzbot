/** Öffentliche Dashboard-Routen (kein Token nötig): Ersteinrichtung, Login, Twitch-OAuth-Rückkehr. */
import express from "express";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { signToken, verifyState } from "./auth.js";
import { safeEqual } from "./security.js";
import { broadcasterId, storeToken, storeBotToken } from "../twitch/api.js";
import { validateToken } from "../twitch/eventsub.js";
import { exchangeCode } from "../twitch/oauth.js";
import { countUsers, createUser, verifyPassword } from "../db/users.js";
import { logAudit } from "../db/audit.js";
import { runTokenHealthCheck } from "../services/token-health.js";
import { wrap, publicBaseUrl, adminTokenUsable } from "./context.js";

export function createAuthRoutes(loginLimiter) {
    const authRoutes = express.Router();
    authRoutes.get("/status", wrap(async (req, res) => res.json({ hasUsers: (await countUsers()) > 0, setupNeedsToken: adminTokenUsable() })));
    authRoutes.post("/setup", wrap(async (req, res) => {
        if ((await countUsers()) > 0) return res.status(409).json({ error: "Es sind bereits Benutzer angelegt." });
        // Die Ersteinrichtung verlangt (wenn gesetzt) den WEB_ADMIN_TOKEN, damit nicht jeder Besucher den Haupt-Admin anlegen kann.
        const wait = loginLimiter.retryAfter(req.ip, "setup");
        if (wait) return res.set("Retry-After", String(wait)).status(429).json({ error: `Zu viele Versuche. Bitte in ${Math.ceil(wait / 60)} Min. erneut versuchen.` });
        if (adminTokenUsable() && !safeEqual(req.body.setupToken, config.web.adminToken)) {
            loginLimiter.fail(req.ip, "setup");
            return res.status(403).json({ error: "Für die Ersteinrichtung wird der WEB_ADMIN_TOKEN aus der .env benötigt." });
        }
        const { username, password } = req.body;
        if (!username || !password || password.length < 8) {
            return res.status(400).json({ error: "Benutzername und ein Passwort mit mindestens 8 Zeichen sind Pflicht." });
        }
        const user = await createUser(username, password, "owner"); // erster Benutzer wird automatisch Haupt-Admin
        res.status(201).json({ token: signToken(user), username: user.username, isAdmin: true, isOwner: true, id: user.id });
    }));
    authRoutes.post("/login", wrap(async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Benutzername und Passwort sind Pflicht." });
        const wait = loginLimiter.retryAfter(req.ip, username);
        if (wait) return res.set("Retry-After", String(wait)).status(429).json({ error: `Zu viele fehlgeschlagene Anmeldungen. Bitte in ${Math.ceil(wait / 60)} Min. erneut versuchen.` });
        const user = await verifyPassword(String(username), String(password));
        if (!user) {
            loginLimiter.fail(req.ip, username);
            return res.status(401).json({ error: "Benutzername oder Passwort ist falsch." });
        }
        loginLimiter.success(username);
        res.json({ token: signToken(user), username: user.username, isAdmin: user.isAdmin, isOwner: user.isOwner, id: user.id });
    }));
    /**
     * Ziel des Twitch-OAuth-Redirects (öffentlich, da Twitch hier ohne eigenes Login-Token aufruft - der
     * "state"-Parameter aus /api/twitch-auth/url übernimmt stattdessen den Schutz gegen Missbrauch).
     * Leitet danach immer zurück ins Dashboard, mit einem Query-Parameter für eine Erfolgs-/Fehlermeldung.
     */
    authRoutes.get("/twitch/callback", wrap(async (req, res) => {
        const base = publicBaseUrl(req);
        const { code, state, error, error_description } = req.query;
        if (error) {
            return res.redirect(`${base}/?twitchAuth=error&message=${encodeURIComponent(error_description || error)}`);
        }
        const statePayload = state ? verifyState(state) : null;
        if (!statePayload?.channel && !statePayload?.bot) {
            return res.redirect(`${base}/?twitchAuth=error&message=${encodeURIComponent("Autorisierung ist abgelaufen oder ungültig, bitte erneut versuchen.")}`);
        }
        const { channel } = statePayload;
        // Fehlersuche: dauert ein Schritt länger als 1 s, steht er mit Dauer im Log
        const step = async (name, fn) => {
            const t = Date.now();
            try {
                return await fn();
            } finally {
                const ms = Date.now() - t;
                if (ms > 1000) logger.warn(`Twitch-Autorisierung, Schritt "${name}": ${ms} ms`);
            }
        };
        if (statePayload.bot) {
            // Autorisierung des BOT-Accounts (beliebiger Account, der im Kanal Moderator ist)
            try {
                const redirectUri = `${base}/api/auth/twitch/callback`;
                const { accessToken, refreshToken } = await step("Code gegen Token tauschen", () => exchangeCode(code, redirectUri));
                const validated = await step("Token prüfen", () => validateToken(accessToken));
                const botLogin = (await fetch("https://api.twitch.tv/helix/users", {
                    headers: { "Client-Id": config.twitchApi.clientId, Authorization: `Bearer ${accessToken}` },
                }).then((r) => r.json()).catch(() => ({})))?.data?.[0]?.login;
                await storeBotToken(accessToken, refreshToken, validated.userId, botLogin);
                runTokenHealthCheck(); // Warnung verschwindet, sobald der neue Token geprüft ist
                logAudit({ actor: "dashboard", action: "edit", targetType: "twitch-bot-token", target: botLogin ?? String(validated.userId), details: {} });
                return res.redirect(`${base}/?twitchAuth=bot-success&message=${encodeURIComponent(botLogin ?? "")}`);
            } catch (e) {
                return res.redirect(`${base}/?twitchAuth=error&message=${encodeURIComponent(e.message)}`);
            }
        }
        try {
            const redirectUri = `${base}/api/auth/twitch/callback`;
            const { accessToken, refreshToken } = await step("Code gegen Token tauschen", () => exchangeCode(code, redirectUri));
            const validated = await step("Token prüfen", () => validateToken(accessToken));
            const id = await step("Kanal-ID holen", () => broadcasterId(channel));
            if (validated.userId && validated.userId !== id) {
                return res.redirect(
                    `${base}/?twitchAuth=wrong-account&channel=${encodeURIComponent(channel)}` +
                        `&message=${encodeURIComponent("Es wurde ein anderer Twitch-Account autorisiert, nicht der Broadcaster-Account dieses Kanals. Bitte erneut versuchen und dabei mit dem Streamer-Account selbst einloggen.")}`,
                );
            }
            await step("Token speichern", () => storeToken(channel, accessToken, refreshToken, validated.userId ?? id));
            runTokenHealthCheck();
            logAudit({ actor: "dashboard", action: "edit", targetType: "twitch-token", target: channel, channel, details: {} });
            res.redirect(`${base}/?twitchAuth=success&channel=${encodeURIComponent(channel)}`);
        } catch (e) {
            res.redirect(`${base}/?twitchAuth=error&message=${encodeURIComponent(e.message)}`);
        }
    }));
    return authRoutes;
}
