/** Dashboard-Routen: Wetten (Twitch-Predictions) */
import { getPrediction } from "../../db/predictions.js";
import { startPrediction, lockPredictionNow, resolvePrediction, cancelPrediction, removePrediction, listAllPredictions } from "../../services/prediction.js";
import { logAudit } from "../../db/audit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerPredictions(api) {
    /* Wetten (Twitch-Predictions mit Channel Points) */
    api.get("/predictions", channelAccessMiddleware, wrap(async (req, res) => res.json(await listAllPredictions(channelOf(req)))));
    api.get("/predictions/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await getPrediction(channelOf(req), Number(req.params.id));
        if (!p) return res.status(404).json({ error: "Wette nicht gefunden" });
        res.json(p);
    }));
    api.post("/predictions", channelAccessMiddleware, wrap(async (req, res) => {
        const { title, outcomes, durationSeconds } = req.body;
        if (!title || !Array.isArray(outcomes)) return res.status(400).json({ error: "title und outcomes (Array) sind Pflicht" });
        const p = await startPrediction(channelOf(req), { title, outcomes, durationSeconds: Number(durationSeconds ?? 60) });
        logAudit({ actor: req.user.username, action: "create", targetType: "prediction", target: title, channel: channelOf(req), details: { outcomes } });
        res.status(201).json(p);
    }));
    api.post("/predictions/:id/lock", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await lockPredictionNow(channelOf(req), Number(req.params.id));
        logAudit({ actor: req.user.username, action: "lock", targetType: "prediction", target: p?.title ?? String(req.params.id), channel: channelOf(req) });
        res.json(p);
    }));
    api.post("/predictions/:id/resolve", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await resolvePrediction(channelOf(req), Number(req.params.id), Number(req.body.winningIndex));
        logAudit({ actor: req.user.username, action: "resolve", targetType: "prediction", target: p?.title ?? String(req.params.id), channel: channelOf(req), details: { winningIndex: Number(req.body.winningIndex) } });
        res.json(p);
    }));
    api.post("/predictions/:id/cancel", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await cancelPrediction(channelOf(req), Number(req.params.id));
        logAudit({ actor: req.user.username, action: "cancel", targetType: "prediction", target: p?.title ?? String(req.params.id), channel: channelOf(req) });
        res.json(p);
    }));
    api.delete("/predictions/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const p = await getPrediction(channelOf(req), Number(req.params.id));
        const ok = await removePrediction(channelOf(req), Number(req.params.id));
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "prediction", target: p?.title ?? String(req.params.id), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
