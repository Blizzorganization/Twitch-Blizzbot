import { logger } from "../utils/logger.js";
import { announce } from "./announce.js";
import { addTimer, listTimers, allTimers, deleteTimer, clearTimers } from "../db/timers.js";
import { UserError } from "../utils/errors.js";
import { getSetting } from "../db/channel-settings.js";

/**
 * Timer und Erinnerungen (!timer). Die Timer stehen in der Datenbank und laufen nach einem Neustart weiter
 * (resumeTimers). Abgelaufene Timer, die der Bot verpasst hat, werden nur noch innerhalb von LATE_LIMIT_MS
 * nachgeholt, danach lohnt die Erinnerung nicht mehr.
 */
export const MAX_SECONDS = 24 * 3600;
export const MAX_PER_CHANNEL = 10;
const LATE_LIMIT_MS = 15 * 60 * 1000;
const MAX_DELAY = 2 ** 31 - 1; // setTimeout-Grenze (ca. 24,8 Tage) - bei 24 h Maximum nie erreicht

const handles = new Map(); // timer id -> setTimeout-Handle

async function fire(timer, late) {
    handles.delete(timer.id);
    // Erst löschen: wer den Timer nicht mehr in der Datenbank findet, hat ihn schon abgebrochen.
    if (!(await deleteTimer(timer.id))) return;
    announce(timer.channel, `⏰ ${timer.text} (Timer von ${timer.owner ?? "?"}${late ? ", verspätet wegen Neustart" : ""})`);
}

function schedule(timer, late = false) {
    const delay = Math.min(Math.max(0, new Date(timer.ends_at).getTime() - Date.now()), MAX_DELAY);
    const handle = setTimeout(() => fire(timer, late).catch((e) => logger.error(`Timer ${timer.id} fehlgeschlagen: ${e.message}`)), delay);
    handle.unref?.();
    handles.set(timer.id, handle);
}

export async function createTimer(channel, owner, text, seconds) {
    if (!(await getSetting(channel, "timersEnabled"))) throw new UserError("Timer sind ausgeschaltet (Dashboard: Chat → Commands → Timer).");
    if ((await listTimers(channel)).length >= MAX_PER_CHANNEL) {
        throw new UserError(`Es laufen schon ${MAX_PER_CHANNEL} Timer.`);
    }
    const timer = await addTimer(channel, text, owner, new Date(Date.now() + seconds * 1000));
    schedule(timer);
    return timer;
}

export const activeTimers = (channel) => listTimers(channel);

export async function cancelTimer(timer) {
    clearTimeout(handles.get(timer.id));
    handles.delete(timer.id);
    return deleteTimer(timer.id);
}

export async function cancelAllTimers(channel) {
    const ids = await clearTimers(channel);
    for (const id of ids) {
        clearTimeout(handles.get(id));
        handles.delete(id);
    }
    return ids.length;
}

/** Nach dem Start (Twitch verbunden): gespeicherte Timer wieder aufnehmen. */
export async function resumeTimers() {
    const now = Date.now();
    let resumed = 0;
    for (const t of await allTimers()) {
        if (handles.has(t.id)) continue;
        const overdue = now - new Date(t.ends_at).getTime();
        if (overdue > LATE_LIMIT_MS) {
            await deleteTimer(t.id); // zu lange her
            continue;
        }
        schedule(t, overdue > 0);
        resumed++;
    }
    if (resumed) logger.info(`${resumed} Timer fortgesetzt.`);
}
