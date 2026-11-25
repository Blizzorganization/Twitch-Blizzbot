import dns from "node:dns";
import net from "node:net";
import { twitchFetch, isTwitchUrl } from "./utils/twitch-fetch.js";

/**
 * Netzwerk-Grundeinstellungen - muss als ERSTES importiert werden (siehe index.js).
 *
 * Hintergrund: Viele Heimnetze/Router/VPNs liefern für Twitch IPv6-Adressen, über die dann aber keine Verbindung
 * zustande kommt. Node probiert dann zuerst IPv6 und gibt erst nach rund 10 Sekunden auf, bevor es IPv4 versucht -
 * jede Anfrage an Twitch (Token erneuern, Autorisierung, Live-Status ...) dauert dann 10 s länger.
 * Darum bevorzugt der Bot IPv4. Wer ein reines IPv6-Netz nutzt, setzt PREFER_IPV6=true in configs/.env.
 */
if (process.env.PREFER_IPV6 !== "true") {
    dns.setDefaultResultOrder("ipv4first");
}
// Falls beide Protokolle probiert werden, nicht ewig auf die erste Adresse warten (Node >= 18.18/20).
net.setDefaultAutoSelectFamilyAttemptTimeout?.(500);

/**
 * Fehlersuche: Schlägt eine ausgehende Anfrage mit "fetch failed" fehl, steht der eigentliche Grund in e.cause
 * (z. B. ECONNRESET, ETIMEDOUT, ENOTFOUND, "other side closed") - den zeigt Node von sich aus nicht. Dieser Wrapper schreibt
 * Methode, Adresse (ohne Parameter, also ohne Tokens) und Grund ins Log und reicht den Fehler unverändert weiter.
 */
const nativeFetch = globalThis.fetch;
/** Unverändertes, eingebautes fetch (für den Netzwerk-Test). */
export const rawFetch = nativeFetch;
// Twitch-Anfragen laufen über twitchFetch (testet alle Server-Adressen, siehe utils/twitch-fetch.js), alles andere normal.
const originalFetch = nativeFetch
    ? (input, init) => {
        try {
            // nur einfache Aufrufe fetch(url, init) - Request-Objekte (mit eigenen Headern/Body) gehen unverändert durch
            const raw = typeof input === "string" ? input : input instanceof URL ? input.href : null;
            if (raw && isTwitchUrl(raw)) return twitchFetch(raw, init);
        } catch (e) {
            if (e?.message?.includes("Body-Typ")) return nativeFetch(input, init);
            /* ungültige URL o. Ä.: das normale fetch meldet den Fehler */
        }
        return nativeFetch(input, init);
    }
    : null;
// Hosts, bei denen zuletzt eine Anfrage fehlgeschlagen ist: beim nächsten Erfolg gibt es "wieder erreichbar".
const failedHosts = new Set();
function noteRecovered(input) {
    try {
        const raw = typeof input === "string" ? input : (input?.url ?? String(input));
        const host = new URL(raw).host;
        if (!failedHosts.delete(host)) return;
        import("./utils/logger.js").then(({ logger }) => logger.ok(`${host === "api.twitch.tv" ? "Twitch-API" : host} wieder erreichbar`)).catch(() => {});
    } catch {
        /* nur Zusatzmeldung */
    }
}

if (originalFetch && !globalThis.fetch.__logsFailures) {
    const wrapped = async (input, init) => {
        const started = Date.now();
        try {
            const res = await originalFetch(input, init);
            if (failedHosts.size) noteRecovered(input);
            return res;
        } catch (e) {
            try {
                const raw = typeof input === "string" ? input : (input?.url ?? String(input));
                const u = new URL(raw);
                const cause = e?.cause;
                const detail = [cause?.code, cause?.message && cause.message !== e.message ? cause.message : null, cause?.errors?.map?.((x) => x.code).join("/")]
                    .filter(Boolean)
                    .join(" – ");
                const { logger } = await import("./utils/logger.js");
                failedHosts.add(u.host);
                logger.warn(`Anfrage fehlgeschlagen: ${(init?.method ?? "GET").toUpperCase()} ${u.origin}${u.pathname} nach ${Date.now() - started} ms – ${e.message}${detail ? ` (${detail})` : ""}`);
            } catch {
                /* Logging darf den ursprünglichen Fehler nie verdecken */
            }
            throw e;
        }
    };
    wrapped.__logsFailures = true;
    globalThis.fetch = wrapped;
}
