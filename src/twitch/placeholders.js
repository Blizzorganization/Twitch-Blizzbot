import { getCounter } from "../db/counters.js";
import { getStream, getChannelInfo } from "./api.js";
import { logger } from "../utils/logger.js";

/**
 * Platzhalter in Custom-Command-Antworten.
 *
 *   {user}            Name des Aufrufers
 *   {touser}          erstes Argument (ohne @), sonst der Aufrufer
 *   {args}            alle Argumente
 *   {channel}         Kanalname
 *   {count}           wie oft der Command schon benutzt wurde
 *   {counter:name}    Zähler erhöhen und neuen Wert einsetzen
 *   {random:1-100}    Zufallszahl (inkl. Grenzen)
 *   {pick:a|b|c}      zufällige Auswahl
 *   {game} {title} {viewers} {uptime}   Stream-Infos (per Twitch-API, nur wenn benutzt)
 *   {time} {date}     Uhrzeit / Datum (deutsche Zeit)
 */

function formatDuration(iso) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} Std. ${m} Min.` : `${m} Min.`;
}

/** Zufallszahl aus "a-b" (Grenzen eingeschlossen); bei ungültiger Angabe bleibt der Platzhalter stehen. */
export function randomFromRange(spec) {
    const m = /^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/.exec(spec);
    if (!m) return null;
    let [a, b] = [Number(m[1]), Number(m[2])];
    if (a > b) [a, b] = [b, a];
    return a + Math.floor(Math.random() * (b - a + 1));
}

export function pickFrom(spec) {
    const options = spec.split("|").map((s) => s.trim()).filter(Boolean);
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
}

const has = (text, name) => text.includes(`{${name}}`);

export async function fillPlaceholders(template, ctx) {
    const first = (ctx.args[0] ?? "").replace(/^@/, "");
    let out = template
        .replaceAll("{user}", ctx.user)
        .replaceAll("{touser}", first || ctx.user)
        .replaceAll("{channel}", ctx.channel)
        .replaceAll("{args}", ctx.args.join(" "))
        .replaceAll("{count}", String(ctx.uses));

    // {counter:name} wie im alten Bot: erhöht den Zähler und setzt den neuen Wert ein
    for (const m of out.match(/\{counter:(.*?)\}/g) ?? []) {
        const value = await getCounter(ctx.channel, m.slice(9, -1));
        if (value !== undefined) out = out.replace(m, String(value));
    }

    out = out.replace(/\{random:([^}]*)\}/g, (whole, spec) => {
        const n = randomFromRange(spec);
        return n === null ? whole : String(n);
    });
    out = out.replace(/\{pick:([^}]*)\}/g, (whole, spec) => pickFrom(spec) ?? whole);

    const now = new Date();
    if (has(out, "time")) out = out.replaceAll("{time}", now.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }));
    if (has(out, "date")) out = out.replaceAll("{date}", now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }));

    // Twitch-API nur abfragen, wenn der Text es wirklich braucht
    const needsStream = has(out, "viewers") || has(out, "uptime");
    const needsInfo = has(out, "game") || has(out, "title");
    try {
        if (needsStream) {
            const stream = await getStream(ctx.channel);
            out = out.replaceAll("{viewers}", stream ? String(stream.viewer_count) : "0")
                .replaceAll("{uptime}", stream ? formatDuration(stream.started_at) : "offline");
        }
        if (needsInfo) {
            const info = await getChannelInfo(ctx.channel);
            out = out.replaceAll("{game}", info?.game_name || "-").replaceAll("{title}", info?.title || "-");
        }
    } catch (e) {
        logger.warn(`Platzhalter-Abfrage fehlgeschlagen: ${e.message}`);
        out = out.replace(/\{(viewers|uptime|game|title)\}/g, "-");
    }
    return out;
}
