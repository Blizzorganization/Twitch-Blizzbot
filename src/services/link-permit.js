import { grantLinkPermit, getLinkPermit, revokeLinkPermit } from "../db/link-permits.js";
import { getStream } from "../twitch/api.js";
import { UserError } from "../utils/errors.js";

/**
 * Link-Freigaben: Ein Nutzer ohne Rolle darf für eine Zeit (oder bis der Stream endet) Links posten, ohne dass der
 * Link-Filter die Nachricht löscht. Alle anderen Filter (Blacklist, Caps, ...) gelten weiter.
 */
export const DEFAULT_SECONDS = 5 * 60;
export const MAX_SECONDS = 12 * 3600; // auch "Stream" gilt höchstens so lange, damit keine Freigabe versehentlich ewig bleibt

const cleanName = (n) => String(n ?? "").trim().replace(/^@/, "").toLowerCase();

/**
 * Gibt einen Nutzer frei.
 * @param {{seconds?: number, untilOffline?: boolean}} options seconds = Dauer; untilOffline = bis der Kanal offline geht (höchstens MAX_SECONDS)
 * @throws {UserError} bei ungültigem Namen/Dauer oder wenn "Stream" gewählt wurde, der Kanal aber nicht live ist
 */
export async function permitLinks(channel, username, grantedBy, { seconds = DEFAULT_SECONDS, untilOffline = false } = {}) {
    const name = cleanName(username);
    if (!/^[a-z0-9_]{1,25}$/.test(name)) throw new UserError("Der Name ist ungültig.");
    if (untilOffline) {
        let live = null;
        try {
            live = await getStream(channel);
        } catch {
            throw new UserError("Ich kann gerade nicht prüfen, ob der Stream läuft. Gib eine Dauer an, z. B. 30m.");
        }
        if (!live) throw new UserError("Der Kanal ist offline. „stream“ geht nur während eines Streams – gib eine Dauer an, z. B. 30m.");
        seconds = MAX_SECONDS;
    }
    if (!Number.isFinite(seconds) || seconds < 1) throw new UserError("Die Dauer ist ungültig.");
    if (seconds > MAX_SECONDS) throw new UserError("Eine Freigabe darf höchstens 12 Stunden dauern.");
    const expiresAt = new Date(Date.now() + seconds * 1000);
    await grantLinkPermit(channel, name, expiresAt, untilOffline, grantedBy);
    return { username: name, expiresAt, untilOffline, seconds };
}

export const revokePermit = (channel, username) => revokeLinkPermit(channel, cleanName(username));

/**
 * Darf der Nutzer gerade Links posten? Eine "bis Stream-Ende"-Freigabe endet, sobald der Kanal offline ist
 * (wird erst beim ersten Link danach festgestellt und dann gelöscht). Lässt sich der Live-Status nicht abfragen,
 * bleibt die Freigabe bis zu ihrem zeitlichen Ablauf gültig.
 */
export async function hasLinkPermit(channel, username) {
    const permit = await getLinkPermit(channel, username);
    if (!permit) return false;
    if (permit.until_offline) {
        let live;
        try {
            live = !!(await getStream(channel));
        } catch {
            return true;
        }
        if (!live) {
            await revokeLinkPermit(channel, username);
            return false;
        }
    }
    return true;
}
