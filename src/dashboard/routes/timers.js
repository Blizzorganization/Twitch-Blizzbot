/** Dashboard-Routen: Timer (Erinnerungen, die nach Ablauf eine Nachricht in den Chat schreiben) */
import { MAX_SECONDS, createTimer, activeTimers, cancelTimer, cancelAllTimers } from "../../services/timer.js";
import { parseDuration } from "../../twitch/chat-commands/timer.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerTimers(api) {
    api.get("/timers", channelAccessMiddleware, wrap(async (req, res) => {
        const now = Date.now();
        const timers = await activeTimers(channelOf(req));
        res.json(timers.map((t) => ({
            id: t.id,
            text: t.text,
            owner: t.owner,
            endsAt: t.ends_at,
            remainingSeconds: Math.max(0, Math.round((new Date(t.ends_at).getTime() - now) / 1000)),
        })));
    }));
    api.post("/timers", channelAccessMiddleware, wrap(async (req, res) => {
        const text = String(req.body.text ?? "").trim();
        const seconds = parseDuration(req.body.duration);
        if (!text) return res.status(400).json({ error: "Der Text ist Pflicht." });
        if (text.length > 400) return res.status(400).json({ error: "Der Text darf höchstens 400 Zeichen lang sein." });
        if (seconds === null || seconds < 1) return res.status(400).json({ error: "Die Dauer kenne ich nicht. Beispiele: 10m, 1h30m, 90s oder 5 (= Minuten)." });
        if (seconds > MAX_SECONDS) return res.status(400).json({ error: "Ein Timer darf höchstens 24 Stunden dauern." });
        // createTimer wirft bei zu vielen laufenden Timern einen UserError (-> 400)
        const t = await createTimer(channelOf(req), req.user.username, text, seconds);
        res.status(201).json({ ok: true, id: t.id });
    }));
    // /timers (alle) VOR /timers/:id registrieren
    api.delete("/timers", channelAccessMiddleware, wrap(async (req, res) => {
        res.json({ ok: true, count: await cancelAllTimers(channelOf(req)) });
    }));
    api.delete("/timers/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const id = Number(req.params.id);
        const timer = (await activeTimers(channelOf(req))).find((t) => t.id === id);
        if (!timer) return res.status(404).json({ ok: false, error: "Diesen Timer gibt es nicht (mehr)." });
        await cancelTimer(timer);
        res.json({ ok: true });
    }));
}
