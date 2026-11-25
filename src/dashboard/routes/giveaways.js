/** Dashboard-Routen: Giveaways und Giveaway-Texte */
import { announce } from "../../services/announce.js";
import { listGiveaways, getGiveaway, listEntries, giveawayHistory } from "../../db/giveaways.js";
import { startGiveaway, stopGiveaway, drawGiveaway, removeGiveaway } from "../../services/giveaway.js";
import { GIVEAWAY_TYPES, formatGiveawayTemplate, listGiveawayTemplates, setGiveawayTemplate, resetGiveawayTemplate } from "../../db/giveaway-templates.js";
import { logAudit } from "../../db/audit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerGiveaways(api) {
    /* Giveaways */
    api.get("/giveaways", channelAccessMiddleware, wrap(async (req, res) => res.json(await listGiveaways(channelOf(req)))));
    api.get("/giveaways-history", channelAccessMiddleware, wrap(async (req, res) => res.json(await giveawayHistory(channelOf(req), 10))));
    api.get("/giveaways/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const g = await getGiveaway(channelOf(req), Number(req.params.id));
        if (!g) return res.status(404).json({ error: "Giveaway nicht gefunden" });
        res.json({ ...g, entries: await listEntries(g.id) });
    }));
    api.post("/giveaways", channelAccessMiddleware, wrap(async (req, res) => {
        const { title, keyword, minPermission, winnerCount, autoDraw, durationSeconds, pointCost } = req.body;
        if (!title || !keyword) return res.status(400).json({ error: "title und keyword sind Pflicht" });
        const endsAt = autoDraw && durationSeconds ? new Date(Date.now() + Number(durationSeconds) * 1000) : null;
        const g = await startGiveaway(channelOf(req), {
            title, keyword, minPermission: Number(minPermission ?? 0), winnerCount: Number(winnerCount ?? 1),
            autoDraw: !!autoDraw && !!endsAt, endsAt, pointCost: Number(pointCost ?? 0),
        });
        logAudit({ actor: req.user.username, action: "create", targetType: "giveaway", target: title, channel: channelOf(req), details: { keyword, winnerCount, pointCost: g.point_cost } });
        res.status(201).json(g);
    }));
    api.post("/giveaways/:id/stop", channelAccessMiddleware, wrap(async (req, res) => {
        const g = await stopGiveaway(channelOf(req), Number(req.params.id));
        logAudit({ actor: req.user.username, action: "stop", targetType: "giveaway", target: g?.title ?? String(req.params.id), channel: channelOf(req) });
        res.json(g);
    }));
    api.post("/giveaways/:id/draw", channelAccessMiddleware, wrap(async (req, res) => {
        const g = await drawGiveaway(channelOf(req), Number(req.params.id));
        logAudit({ actor: req.user.username, action: "draw", targetType: "giveaway", target: g?.title ?? String(req.params.id), channel: channelOf(req), details: { winners: g?.winners } });
        res.json(g);
    }));
    api.delete("/giveaways/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const g = await getGiveaway(channelOf(req), Number(req.params.id));
        const ok = await removeGiveaway(channelOf(req), Number(req.params.id));
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "giveaway", target: g?.title ?? String(req.params.id), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));

    /* Giveaway-Texte (Start/Erinnerung/Teilnahme/Ende/Ziehung) */
    api.get("/giveaway-templates", channelAccessMiddleware, wrap(async (req, res) => res.json(await listGiveawayTemplates(channelOf(req)))));
    api.put("/giveaway-templates/:type", channelAccessMiddleware, wrap(async (req, res) => {
        const { type } = req.params;
        if (!(type in GIVEAWAY_TYPES)) return res.status(404).json({ error: "Unbekannter Text-Typ" });
        const template = String(req.body.template ?? "").trim();
        if (!template) return res.status(400).json({ error: "template darf nicht leer sein" });
        await setGiveawayTemplate(channelOf(req), type, template);
        logAudit({ actor: req.user.username, action: "edit", targetType: "giveaway-template", target: type, channel: channelOf(req) });
        res.json({ ok: true });
    }));
    api.delete("/giveaway-templates/:type", channelAccessMiddleware, wrap(async (req, res) => {
        await resetGiveawayTemplate(channelOf(req), req.params.type);
        res.json({ ok: true });
    }));
    api.post("/giveaway-templates/:type/test", channelAccessMiddleware, wrap(async (req, res) => {
        const { type } = req.params;
        const def = GIVEAWAY_TYPES[type];
        if (!def) return res.status(404).json({ error: "Unbekannter Text-Typ" });
        const channel = channelOf(req);
        const current = (await listGiveawayTemplates(channel)).find((a) => a.type === type);
        announce(channel, formatGiveawayTemplate(current.template, def.sample));
        res.json({ ok: true });
    }));
}
