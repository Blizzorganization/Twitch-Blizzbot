import { UserError } from "../utils/errors.js";
import { announce } from "./announce.js";
import { apiConfigured, createTwitchPrediction, endTwitchPrediction } from "../twitch/api.js";
import {
    getActivePrediction,
    getPrediction,
    createPrediction,
    setPredictionStatus,
    listPredictions,
    deletePrediction,
} from "../db/predictions.js";

function announceStart(channel, p) {
    const opts = p.outcomes.map((o, i) => `${i + 1}: ${o.title}`).join(" | ");
    announce(channel, `🔮 Wette gestartet: "${p.title}" – ${opts} (mit Channel Points auf twitch.tv/${channel} abstimmen!)`);
}

function announceResolved(p, winnerTitle) {
    announce(p.channel, `🔮 Wette "${p.title}" ausgewertet – Gewinner-Ergebnis: ${winnerTitle}`);
}

function announceCanceled(p) {
    announce(p.channel, `🔮 Wette "${p.title}" wurde abgebrochen, alle Einsätze wurden zurückerstattet.`);
}

/** Vom Dashboard: neue Wette (Twitch-Prediction mit Channel Points) starten. */
export async function startPrediction(channel, { title, outcomes, durationSeconds = 60 }) {
    if (!apiConfigured()) throw new UserError("Twitch-API ist nicht konfiguriert.");
    if (!title?.trim()) throw new UserError("Ein Titel ist Pflicht.");
    if (!Array.isArray(outcomes) || outcomes.length < 2 || outcomes.length > 10) {
        throw new UserError("Eine Wette braucht 2 bis 10 Ergebnisse.");
    }
    const current = await getActivePrediction(channel);
    if (current) throw new UserError("Es läuft bereits eine Wette für diesen Kanal.");

    let created;
    try {
        created = await createTwitchPrediction(channel, title, outcomes, durationSeconds);
    } catch (e) {
        // Twitch verlangt für Predictions aktivierte Kanalpunkte (und Affiliate/Partner-Status).
        if (/channel points not enabled/i.test(e?.message ?? "")) {
            throw new UserError("Twitch lehnt die Wette ab: Kanalpunkte sind in diesem Kanal nicht aktiviert. Aktiviere sie in Twitch unter Creator-Dashboard → Community → Kanalpunkte (Predictions gibt es nur für Affiliate/Partner).");
        }
        throw e;
    }
    if (!created) throw new UserError("Wette konnte nicht erstellt werden (Scope channel:manage:predictions?).");

    const mapped = created.outcomes.map((o, i) => ({ title: outcomes[i] ?? o.title, twitchOutcomeId: o.id }));
    const prediction = await createPrediction(channel, { title, outcomes: mapped, durationSeconds, twitchPredictionId: created.id });
    announceStart(channel, prediction);
    return prediction;
}

/** Beendet die Annahme neuer Einsätze vorzeitig (Twitch sperrt sonst automatisch nach Ablauf des Zeitfensters). */
export async function lockPredictionNow(channel, id) {
    const p = await getPrediction(channel, id);
    if (!p || p.status !== "active") throw new UserError("Wette nicht gefunden oder nicht aktiv.");
    await endTwitchPrediction(channel, p.twitch_prediction_id, "LOCKED");
    return setPredictionStatus(channel, id, "locked");
}

/** Wertet die Wette aus: winningIndex ist der Index (0-basiert) des gewonnenen Ergebnisses. */
export async function resolvePrediction(channel, id, winningIndex) {
    const p = await getPrediction(channel, id);
    if (!p) throw new UserError("Wette nicht gefunden.");
    if (p.status === "resolved" || p.status === "canceled") throw new UserError("Diese Wette ist bereits abgeschlossen.");
    const outcome = p.outcomes[winningIndex];
    if (!outcome) throw new UserError("Ungültiges Ergebnis.");
    await endTwitchPrediction(channel, p.twitch_prediction_id, "RESOLVED", outcome.twitchOutcomeId);
    const updated = await setPredictionStatus(channel, id, "resolved", { winningOutcome: winningIndex });
    announceResolved(updated, outcome.title);
    return updated;
}

/** Bricht die Wette ab, Twitch erstattet den Zuschauern automatisch ihre Punkte zurück. */
export async function cancelPrediction(channel, id) {
    const p = await getPrediction(channel, id);
    if (!p) throw new UserError("Wette nicht gefunden.");
    if (p.status === "resolved" || p.status === "canceled") throw new UserError("Diese Wette ist bereits abgeschlossen.");
    await endTwitchPrediction(channel, p.twitch_prediction_id, "CANCELED");
    const updated = await setPredictionStatus(channel, id, "canceled");
    announceCanceled(updated);
    return updated;
}

export async function removePrediction(channel, id) {
    return deletePrediction(channel, id);
}

export async function listAllPredictions(channel) {
    return listPredictions(channel);
}
