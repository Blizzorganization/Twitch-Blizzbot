import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const EXPIRES_IN = "30d";

/**
 * Zufällige ID, die bei jedem Prozessstart neu erzeugt wird. Sie landet in jedem ausgestellten
 * Token und wird bei der Prüfung mit der aktuellen BOOT_ID verglichen - nach einem Neustart des
 * Bots (und damit des Web-Servers) stimmt sie nicht mehr überein, alte Tokens werden ungültig und
 * man landet wieder auf dem Login-Screen, statt automatisch eingeloggt zu bleiben.
 */
export const BOOT_ID = crypto.randomUUID();

export function signToken(user) {
    return jwt.sign({ sub: user.id, username: user.username, boot: BOOT_ID, tv: user.tokenVersion ?? 0 }, config.web.jwtSecret, { expiresIn: EXPIRES_IN });
}

/** @returns {{sub: number, username: string} | null} */
export function verifyToken(token) {
    try {
        const payload = jwt.verify(token, config.web.jwtSecret);
        if (payload.boot !== BOOT_ID) return null;
        return payload;
    } catch {
        return null;
    }
}

/**
 * Kurzlebiger, signierter "state"-Parameter für den Twitch-OAuth-Flow (Tab "Benutzer" -> Button
 * "Anwendung autorisieren"). Trägt nur den Kanalnamen und verhindert, dass ein fremder Aufrufer den
 * Redirect auf /api/auth/twitch/callback für einen beliebigen Kanal missbrauchen kann (CSRF-Schutz).
 */
export function signState(payload) {
    return jwt.sign(payload, config.web.jwtSecret, { expiresIn: "10m" });
}

export function verifyState(token) {
    try {
        return jwt.verify(token, config.web.jwtSecret);
    } catch {
        return null;
    }
}
