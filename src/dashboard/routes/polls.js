/** Dashboard-Routen: Umfragen */
import { listPolls, getPoll } from "../../db/polls.js";
import { startPoll, endPollNow, removePoll } from "../../services/poll.js";
import { logAudit } from "../../db/audit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerPolls(api) {
    /* Umfragen */
    api.get("/polls", channelAccessMiddleware, wrap(async (req, res) => res.json(await listPolls(channelOf(req)))));
    api.get("/polls/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await getPoll(channelOf(req), Number(req.params.id));
        if (!p) return res.status(404).json({ error: "Umfrage nicht gefunden" });
        res.json(p);
    }));
    api.post("/polls", channelAccessMiddleware, wrap(async (req, res) => {
        const { title, options, mode, durationSeconds } = req.body;
        if (!title || !Array.isArray(options)) return res.status(400).json({ error: "title und options (Array) sind Pflicht" });
        const p = await startPoll(channelOf(req), { title, options, mode, durationSeconds: Number(durationSeconds ?? 60) });
        logAudit({ actor: req.user.username, action: "create", targetType: "poll", target: title, channel: channelOf(req) });
        res.status(201).json(p);
    }));
    api.post("/polls/:id/end", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await endPollNow(channelOf(req), Number(req.params.id));
        logAudit({ actor: req.user.username, action: "end", targetType: "poll", target: p?.title ?? String(req.params.id), channel: channelOf(req) });
        res.json(p);
    }));
    api.delete("/polls/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await removePoll(channelOf(req), Number(req.params.id));
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "poll", target: String(req.params.id), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
