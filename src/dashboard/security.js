import crypto from "node:crypto";

/** Werte, die aus Beispieldateien/Standardwerten stammen und niemals als Geheimnis taugen. */
const PLACEHOLDER = /^(changeme|change-me|bitte-aendern|bitte_aendern|secret|password|passwort|admin|test|example)/i;

/** Ein Geheimnis gilt als unbrauchbar, wenn es leer, ein bekannter Platzhalter oder kürzer als 16 Zeichen ist. */
export function isWeakSecret(value) {
    const v = String(value ?? "").trim();
    return v.length < 16 || PLACEHOLDER.test(v);
}

/** Zeitkonstanter Vergleich (verhindert, dass man ein Geheimnis über Antwortzeiten Zeichen für Zeichen erraten kann). */
export function safeEqual(a, b) {
    const ha = crypto.createHash("sha256").update(String(a ?? "")).digest();
    const hb = crypto.createHash("sha256").update(String(b ?? "")).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/**
 * Begrenzung für fehlgeschlagene Anmeldungen (im Speicher): pro IP-Adresse und pro Benutzername getrennt, damit weder
 * ein einzelner Rechner noch wechselnde IPs gegen EINEN Benutzer beliebig oft raten können. Erfolgreiche Anmeldung
 * setzt den Zähler des Benutzernamens zurück.
 */
export function createLoginLimiter({ windowMs = 15 * 60_000, maxPerIp = 20, maxPerUser = 10 } = {}) {
    const hits = new Map(); // key -> number[] (Zeitpunkte der Fehlversuche)
    const recent = (key, now) => {
        const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
        if (list.length) hits.set(key, list);
        else hits.delete(key);
        return list;
    };
    const timer = setInterval(() => { const now = Date.now(); for (const k of [...hits.keys()]) recent(k, now); }, windowMs).unref();
    void timer;
    return {
        /** Sekunden bis zum nächsten erlaubten Versuch, 0 = erlaubt. */
        retryAfter(ip, username, now = Date.now()) {
            let wait = 0;
            for (const [key, max] of [[`ip:${ip}`, maxPerIp], [`user:${String(username ?? "").toLowerCase()}`, maxPerUser]]) {
                const list = recent(key, now);
                if (list.length >= max) wait = Math.max(wait, Math.ceil((list[0] + windowMs - now) / 1000));
            }
            return wait;
        },
        fail(ip, username, now = Date.now()) {
            for (const key of [`ip:${ip}`, `user:${String(username ?? "").toLowerCase()}`]) hits.set(key, [...recent(key, now), now]);
        },
        success(username) { hits.delete(`user:${String(username ?? "").toLowerCase()}`); },
    };
}

/** Sicherheits-Header für alle Antworten. */
/**
 * Allgemeine Anfrage-Begrenzung pro IP (fester Zeitraum). Ohne zusätzliches Paket, damit sich der Lockfile nicht ändert.
 * Bei Überschreitung: 429 mit Retry-After. Hinter einem Reverse-Proxy WEB_TRUST_PROXY setzen, sonst zählt die Proxy-IP.
 */
export function createRateLimiter({ windowMs = 60_000, limit = 1000, message = "Zu viele Anfragen. Bitte kurz warten." } = {}) {
    const hits = new Map(); // ip -> { count, reset }
    setInterval(() => {
        const now = Date.now();
        for (const [ip, h] of hits) if (h.reset <= now) hits.delete(ip);
    }, windowMs).unref();
    return function rateLimiter(req, res, next) {
        const now = Date.now();
        const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
        let h = hits.get(ip);
        if (!h || h.reset <= now) {
            h = { count: 0, reset: now + windowMs };
            hits.set(ip, h);
        }
        h.count++;
        res.setHeader("RateLimit-Limit", String(limit));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - h.count)));
        if (h.count > limit) {
            res.setHeader("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
            return res.status(429).json({ error: message });
        }
        next();
    };
}

export function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Skripte nur von der eigenen Seite; Bilder auch von https/data (Avatare, Vorschaubilder); Inline-Styles braucht React.
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
    next();
}

/** Datenbank-/Systemfehler gehen nicht im Klartext an den Browser (Tabellen-, Spaltennamen, Hosts ...). */
export function publicErrorMessage(e) {
    const msg = String(e?.message ?? "");
    const internal =
        /^[0-9A-Z]{5}$/.test(String(e?.code ?? "")) || // Postgres-Fehlercode
        /relation "|column "|syntax error|violates|connection|ECONN|ENOTFOUND|ETIMEDOUT|password authentication|pg_|SQL/i.test(msg);
    return internal ? "Interner Fehler (Details stehen im Log des Bots)." : msg;
}
