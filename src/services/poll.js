import { logger } from "../utils/logger.js";
import { UserError } from "../utils/errors.js";
import { announce } from "./announce.js";
import { apiConfigured, createTwitchPoll, getTwitchPoll, endTwitchPoll } from "../twitch/api.js";
import { getActivePoll, getPoll, createPoll, vote, tally, endPoll, listPolls } from "../db/polls.js";

const timers = new Map(); // poll.id -> Timeout

function scheduleEnd(channel, poll) {
    const ms = new Date(poll.ends_at).getTime() - Date.now();
    const timer = setTimeout(() => finish(channel, poll.id).catch((e) => logger.error("Umfrage-Ende fehlgeschlagen:", e)), Math.max(0, ms));
    timer.unref?.();
    timers.set(poll.id, timer);
}

function announceStart(channel, poll) {
    const opts = poll.options.map((o, i) => `${i + 1}: ${o}`).join(" | ");
    if (poll.mode === "chat") {
        announce(channel, `📊 Umfrage: "${poll.title}" – ${opts} (mit der Zahl im Chat abstimmen!)`);
    } else {
        announce(channel, `📊 Umfrage läuft auf Twitch: "${poll.title}" – ${opts}`);
    }
}

/** Chat-Nachricht zum Ende: nur der Sieger hervorgehoben, der Rest danach (Gleichstand: alle Erstplatzierten als Sieger). */
export function resultText(options, counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return "Keine Stimmen abgegeben.";
    const pct = (n) => Math.round((100 * n) / total);
    const fmt = (i) => `${options[i]}: ${counts[i]} (${pct(counts[i])}%)`;
    const max = Math.max(...counts);
    const winners = counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
    const rest = counts.map((_, i) => i).filter((i) => !winners.includes(i));
    const head = `${winners.length > 1 ? "Gleichstand" : "Sieger"}: ${winners.map(fmt).join(" | ")}`;
    return rest.length ? `${head} | Rest: ${rest.map(fmt).join(" | ")}` : head;
}

function announceResult(poll, counts) {
    announce(poll.channel, `📊 Umfrage beendet: "${poll.title}" – ${resultText(poll.options, counts)}`);
}

async function finish(channel, id) {
    const poll = await getPoll(channel, id);
    if (!poll || poll.status === "ended") return;
    let counts;
    if (poll.mode === "twitch" && poll.twitch_poll_id) {
        try {
            await endTwitchPoll(channel, poll.twitch_poll_id).catch(() => {});
            const info = await getTwitchPoll(channel, poll.twitch_poll_id);
            counts = (info?.choices ?? poll.options.map(() => ({ votes: 0 }))).map((c) => c.votes ?? 0);
        } catch (e) {
            logger.warn(`Twitch-Umfrage-Ergebnis nicht abrufbar: ${e.message}`);
            counts = await tally(id, poll.options.length);
        }
    } else {
        counts = await tally(id, poll.options.length);
    }
    const ended = await endPoll(channel, id, counts);
    announceResult(ended, counts);
    return ended;
}

/** Vom Dashboard: neue Umfrage starten. mode: "chat" (Stimmen per Zahl im Chat) oder "twitch" (natives Twitch-Poll). */
export async function startPoll(channel, { title, options, mode = "chat", durationSeconds = 60 }) {
    if (!Array.isArray(options) || options.length < 2) throw new UserError("Eine Umfrage braucht mindestens 2 Antwortmöglichkeiten.");
    const current = await getActivePoll(channel);
    if (current) await finish(channel, current.id);

    let twitchPollId = null;
    if (mode === "twitch") {
        if (!apiConfigured()) throw new UserError("Twitch-API ist nicht konfiguriert – Modus 'chat' verwenden.");
        const created = await createTwitchPoll(channel, title, options, durationSeconds);
        if (!created) throw new UserError("Twitch-Umfrage konnte nicht erstellt werden (Scope channel:manage:polls?).");
        twitchPollId = created.id;
    }

    const poll = await createPoll(channel, { title, options, mode, durationSeconds, twitchPollId });
    if (mode !== "twitch") announceStart(channel, poll); // Twitch zeigt sein Poll-UI selbst an
    scheduleEnd(channel, poll);
    return poll;
}

export async function endPollNow(channel, id) {
    clearTimeout(timers.get(id));
    const result = await finish(channel, id);
    if (!result) throw new UserError("Umfrage nicht gefunden oder bereits beendet.");
    return result;
}

export async function removePoll(channel, id) {
    clearTimeout(timers.get(id));
    const { deletePoll } = await import("../db/polls.js");
    return deletePoll(channel, id);
}

/** Von der Chat-Pipeline: Stimme per Zahl (nur im "chat"-Modus relevant). */
export async function handlePollMessage(channel, tags, message) {
    const trimmed = message.trim();
    if (!/^[0-9]+$/.test(trimmed)) return false;
    const poll = await getActivePoll(channel);
    if (!poll || poll.mode !== "chat") return false;
    return vote(poll.id, tags.username, Number(trimmed), poll.options.length);
}

export async function resumePolls() {
    const { config } = await import("../config.js");
    for (const c of config.twitch.channels) {
        for (const p of await listPolls(c, { status: "active" })) scheduleEnd(c, p);
    }
}
