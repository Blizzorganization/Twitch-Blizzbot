import { getAlertEnabled, getAlertTemplate, getAlertAsAction, formatAlert } from "../db/alerts.js";
import { announce } from "./announce.js";

const lastTrain = new Map(); // channel -> ID des zuletzt gemeldeten Hype Trains (Schutz gegen doppelte Events)

/** "A (1.200), B (800), C (350)" aus den Top-Beiträgen eines Hype Trains (V2: topContributions, V1: topContributors). */
export function topSupporters(event, max = 3) {
    const list = event?.topContributions ?? event?.topContributors ?? [];
    return [...list]
        .map((c) => ({ name: c.userDisplayName ?? c.userName ?? c.user_name ?? "?", total: Number(c.total ?? 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, max)
        .map((c) => `${c.name} (${c.total.toLocaleString("de-DE")})`)
        .join(", ");
}

/** Vom EventSub-Listener am Ende eines Hype Trains aufgerufen: schreibt die Zusammenfassung in den Chat. */
export async function handleHypeTrainEnd(channel, event) {
    if (!(await getAlertEnabled(channel, "hypetrain"))) return;
    const id = event?.id ?? null;
    if (id && lastTrain.get(channel) === id) return;
    if (id) lastTrain.set(channel, id);
    const text = formatAlert(await getAlertTemplate(channel, "hypetrain"), {
        level: event?.level ?? 1,
        total: Number(event?.total ?? 0).toLocaleString("de-DE"),
        top: topSupporters(event) || "niemand",
    });
    announce(channel, text, await getAlertAsAction(channel, "hypetrain"));
}
