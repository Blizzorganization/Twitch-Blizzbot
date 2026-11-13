import { logger } from "../utils/logger.js";
import { UserError } from "../utils/errors.js";
import { announce } from "./announce.js";
import {
    getOpenGiveaway,
    getGiveaway,
    createGiveaway,
    closeGiveaway,
    deleteGiveaway,
    addEntry,
    matchOpenGiveaway,
    hasEntry,
    countEntries,
    drawWinners,
    listGiveaways,
} from "../db/giveaways.js";
import { getGiveawayTemplate, formatGiveawayTemplate, GIVEAWAY_DRAW_EMPTY_DEFAULT } from "../db/giveaway-templates.js";
import { getSetting } from "../db/channel-settings.js";
import { trySpendPoints } from "../db/leveling.js";

const timers = new Map(); // giveaway.id -> Timeout (Auto-Ziehung)
const repeatTimers = new Map(); // channel -> Interval (Erinnerung "Giveaway läuft noch")

function scheduleAutoDraw(channel, giveaway) {
    if (!giveaway.auto_draw || !giveaway.ends_at) return;
    const ms = new Date(giveaway.ends_at).getTime() - Date.now();
    const timer = setTimeout(() => finish(channel, giveaway.id).catch((e) => logger.error("Giveaway-Auto-Draw fehlgeschlagen:", e)), Math.max(0, ms));
    timer.unref?.();
    timers.set(giveaway.id, timer);
}

function stopRepeat(channel) {
    clearInterval(repeatTimers.get(channel));
    repeatTimers.delete(channel);
}

/** Startet (bzw. erneuert) die periodische "Giveaway läuft noch"-Erinnerung für einen Kanal. */
async function scheduleRepeat(channel, giveaway) {
    stopRepeat(channel);
    const minutes = await getSetting(channel, "giveawayRepeatMinutes");
    if (!minutes || minutes <= 0) return;
    const timer = setInterval(async () => {
        try {
            const current = await getOpenGiveaway(channel);
            if (!current || current.id !== giveaway.id) {
                stopRepeat(channel);
                return;
            }
            const template = await getGiveawayTemplate(channel, "repeat");
            announce(channel, formatGiveawayTemplate(template, { title: current.title, keyword: current.keyword }));
        } catch (e) {
            logger.warn(`Giveaway-Erinnerung fehlgeschlagen: ${e.message}`);
        }
    }, 60_000 * minutes);
    timer.unref?.();
    repeatTimers.set(channel, timer);
}

async function finish(channel, id) {
    stopRepeat(channel);
    const closed = await closeGiveaway(channel, id);
    if (!closed) return; // schon geschlossen/gezogen
    const result = await drawWinners(channel, id);
    await announceResult(channel, result);
}

async function announceResult(channel, result) {
    if (!result) return;
    if (!result.winners.length) {
        announce(channel, formatGiveawayTemplate(GIVEAWAY_DRAW_EMPTY_DEFAULT, { title: result.title }));
        return;
    }
    const template = await getGiveawayTemplate(channel, "draw");
    announce(channel, formatGiveawayTemplate(template, { title: result.title, winners: result.winners.join(", ") }));
}

/** Vom Dashboard: neues Giveaway starten (schließt automatisch ein evtl. offenes). */
export async function startGiveaway(channel, opts) {
    const current = await getOpenGiveaway(channel);
    if (current) await closeGiveaway(channel, current.id);
    const g = await createGiveaway(channel, opts);
    scheduleAutoDraw(channel, g);
    const template = await getGiveawayTemplate(channel, "start");
    announce(channel, formatGiveawayTemplate(template, { title: g.title, keyword: g.keyword }));
    await scheduleRepeat(channel, g);
    return g;
}

/** Vom Dashboard: Teilnahme schließen, ohne zu ziehen. */
export async function stopGiveaway(channel, id) {
    clearTimeout(timers.get(id));
    stopRepeat(channel);
    const g = await closeGiveaway(channel, id);
    if (!g) throw new UserError("Dieses Giveaway ist nicht offen.");
    const template = await getGiveawayTemplate(channel, "end");
    announce(channel, formatGiveawayTemplate(template, { title: g.title }));
    return g;
}

/** Vom Dashboard: Gewinner ziehen (schließt bei Bedarf zuerst). */
export async function drawGiveaway(channel, id) {
    clearTimeout(timers.get(id));
    stopRepeat(channel);
    const g = await getGiveaway(channel, id);
    if (!g) throw new UserError("Giveaway nicht gefunden.");
    if (g.status === "open") await closeGiveaway(channel, id);
    if (g.status === "drawn") throw new UserError("Für dieses Giveaway wurden schon Gewinner gezogen.");
    const result = await drawWinners(channel, id);
    await announceResult(channel, result);
    return result;
}

export async function removeGiveaway(channel, id) {
    clearTimeout(timers.get(id));
    stopRepeat(channel);
    return deleteGiveaway(channel, id);
}

/** Von der Chat-Pipeline bei jeder Nachricht eines Nutzers aufgerufen. */
export async function handleGiveawayMessage(channel, tags, message) {
    const word = message.trim().toLowerCase();
    if (!word) return false;
    const open = await matchOpenGiveaway(channel, word);
    if (!open) return false;
    if (await hasEntry(open.id, tags.username)) return false; // schon dabei – kein erneuter Abzug/Chat-Spam
    if (open.point_cost > 0 && !(await trySpendPoints(channel, tags.username, open.point_cost))) return false; // zu wenig Punkte
    const result = await addEntry(channel, word, tags.username, tags["display-name"] ?? tags.username);
    if (!result?.isNew) return false;
    const template = await getGiveawayTemplate(channel, "join");
    announce(channel, formatGiveawayTemplate(template, { user: tags["display-name"] ?? tags.username, title: result.giveaway.title }));
    return true;
}

/** Beim Start: für alle offenen Giveaways mit auto_draw die Timer neu setzen (nach einem Neustart). */
export async function resumeGiveaways() {
    for (const g of await allOpenAcrossChannels()) {
        scheduleAutoDraw(g.channel, g);
        await scheduleRepeat(g.channel, g);
    }
}

async function allOpenAcrossChannels() {
    const { config } = await import("../config.js");
    const all = [];
    for (const c of config.twitch.channels) all.push(...(await listGiveaways(c, { status: "open" })));
    return all;
}
