import https from "node:https";
import net from "node:net";
import dns from "node:dns";

/**
 * Eigene, robuste Anfrage-Funktion für Twitch (id.twitch.tv, api.twitch.tv).
 *
 * Hintergrund: Der Name id.twitch.tv liefert mehrere Server-Adressen (CloudFront). Ist eine davon im eigenen Netz
 * nicht erreichbar, versucht Nodes eingebautes fetch nur diese eine und gibt erst nach 10 Sekunden auf
 * ("UND_ERR_CONNECT_TIMEOUT") - Token-Erneuerung und Autorisierung scheitern oder dauern 10 s.
 * Diese Funktion testet ALLE Adressen gleichzeitig (TCP, Port 443), nimmt die schnellste erreichbare und merkt sie
 * sich ein paar Minuten. TLS-Prüfung und Zertifikat laufen normal gegen den Hostnamen, nur die Adresse wird gewählt.
 */
const CACHE_TTL_MS = 5 * 60_000;
const PROBE_TIMEOUT_MS = 2500;
const REQUEST_TIMEOUT_MS = 30_000;
const cache = new Map(); // host -> { address, family, at }

export function probe(address, family, port = 443, timeoutMs = PROBE_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const socket = net.connect({ host: address, port, family });
        const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
        socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve(true); });
        socket.once("error", () => { clearTimeout(timer); resolve(false); });
    });
}

/** Wählt die schnellste erreichbare Adresse (IPv4 zuerst); fällt auf die erste zurück, wenn keine antwortet. */
export async function pickAddress(host, { resolver = dns.promises.lookup, probeFn = probe, port = 443 } = {}) {
    const cached = cache.get(host);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;
    const all = await resolver(host, { all: true });
    const ordered = [...all.filter((a) => a.family === 4), ...all.filter((a) => a.family !== 4)];
    const winner = await new Promise((resolve) => {
        let pending = ordered.length;
        let done = false;
        for (const a of ordered) {
            probeFn(a.address, a.family, port).then((ok) => {
                pending -= 1;
                if (ok && !done) { done = true; resolve(a); }
                else if (pending === 0 && !done) resolve(ordered[0]);
            });
        }
    });
    const chosen = { address: winner.address, family: winner.family, at: Date.now() };
    cache.set(host, chosen);
    return chosen;
}

const lookup = (hostname, options, callback) => {
    pickAddress(hostname).then(
        (a) => (options?.all ? callback(null, [{ address: a.address, family: a.family }]) : callback(null, a.address, a.family)),
        (e) => callback(e),
    );
};

export const TWITCH_HOSTS = new Set(["id.twitch.tv", "api.twitch.tv"]);
export const isTwitchUrl = (url) => TWITCH_HOSTS.has(new URL(url).hostname);

/** fetch-kompatibel für einfache Anfragen (Text-/Formular-/JSON-Body, keine Weiterleitungen). */
export function twitchFetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : (input?.url ?? String(input)));
    const method = String(init.method ?? "GET").toUpperCase();
    const headers = {};
    new Headers(init.headers ?? {}).forEach((value, key) => { headers[key] = value; });
    let body = init.body;
    if (body instanceof URLSearchParams) {
        body = body.toString();
        headers["content-type"] ??= "application/x-www-form-urlencoded;charset=UTF-8";
    }
    if (body != null && typeof body !== "string" && !Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
        throw new TypeError("twitchFetch: Body-Typ wird nicht unterstützt");
    }
    if (body != null) headers["content-length"] = String(Buffer.byteLength(body));
    headers["user-agent"] ??= "blizzbot";
    headers.accept ??= "*/*";

    return new Promise((resolve, reject) => {
        const req = https.request(
            { protocol: url.protocol, hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method, headers, lookup, timeout: REQUEST_TIMEOUT_MS },
            (res) => {
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("error", reject);
                res.on("end", () => {
                    const responseHeaders = new Headers();
                    for (const [k, v] of Object.entries(res.headers)) {
                        if (Array.isArray(v)) v.forEach((x) => responseHeaders.append(k, x));
                        else if (v != null) responseHeaders.set(k, v);
                    }
                    const status = res.statusCode;
                    const noBody = status === 204 || status === 205 || status === 304;
                    resolve(new Response(noBody ? null : Buffer.concat(chunks), { status, statusText: res.statusMessage, headers: responseHeaders }));
                });
            },
        );
        req.on("timeout", () => req.destroy(Object.assign(new Error("Zeitüberschreitung"), { code: "ETIMEDOUT" })));
        req.on("error", (e) => {
            cache.delete(url.hostname); // beim nächsten Mal neu wählen
            reject(Object.assign(new TypeError("fetch failed"), { cause: e }));
        });
        if (init.signal) {
            if (init.signal.aborted) return req.destroy(init.signal.reason);
            init.signal.addEventListener("abort", () => req.destroy(init.signal.reason), { once: true });
        }
        if (body != null) req.write(body);
        req.end();
    });
}
