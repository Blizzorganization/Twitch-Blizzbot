import { listGreetings, markGreeted } from "../db/greetings.js";
import { getStream } from "../twitch/api.js";
import { announce } from "./announce.js";
import { formatAlert } from "../db/alerts.js";
import { cleanChannel } from "../db/init.js";
import { getSetting } from "../db/channel-settings.js";
import { logger } from "../utils/logger.js";

const CACHE_MS = 30_000;
const STREAM_CACHE_MS = 60_000;
const lists = new Map(); // channel -> { at, users: Map(name -> { enabled, lastStreamId }) }
const streams = new Map(); // channel -> { at, id }

/** Nach Änderungen im Dashboard sofort neu laden. */
export function invalidateGreetings(channel) {
    lists.delete(cleanChannel(channel));
}

async function users(channel) {
    const c = cleanChannel(channel);
    const cached = lists.get(c);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.users;
    const map = new Map((await listGreetings(c)).map((r) => [r.username, { enabled: r.enabled, lastStreamId: r.last_stream_id }]));
    lists.set(c, { at: Date.now(), users: map });
    return map;
}

/** ID des laufenden Streams (null = offline oder nicht ermittelbar), 60 s zwischengespeichert. */
async function currentStreamId(channel) {
    const c = cleanChannel(channel);
    const cached = streams.get(c);
    if (cached && Date.now() - cached.at < STREAM_CACHE_MS) return cached.id;
    let id = null;
    try {
        id = (await getStream(c))?.id ?? null;
    } catch (e) {
        logger.debug(`Begrüßung: Stream-Status nicht abrufbar: ${e.message}`);
        return cached?.id ?? null;
    }
    streams.set(c, { at: Date.now(), id });
    return id;
}

/** Bei jeder Chatnachricht aufgerufen: begrüßt hinterlegte Nutzer bei ihrer ersten Nachricht im laufenden Stream. */
export async function handleGreeting(channel, tags) {
    const name = String(tags.username ?? "").toLowerCase();
    if (!(await getSetting(channel, "greetingsEnabled"))) return; // Funktion im Dashboard ausgeschaltet
    const entry = (await users(channel)).get(name);
    if (!entry?.enabled) return;
    const streamId = await currentStreamId(channel);
    if (!streamId) return; // nur im laufenden Stream
    if (entry.lastStreamId === String(streamId)) return; // schon begrüßt (ohne Datenbankzugriff)
    entry.lastStreamId = String(streamId);
    const message = await markGreeted(channel, name, streamId);
    if (!message) return;
    announce(channel, formatAlert(message, { user: tags["display-name"] ?? tags.username }), false);
}
