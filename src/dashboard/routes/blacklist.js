/** Dashboard-Routen: Blacklist und Link-Freigaben */
import { listBlacklist, addBlacklist, updateBlacklist, deleteBlacklist, invalidateBlacklistCache } from "../../db/blacklist.js";
import { logAudit } from "../../db/audit.js";
import { listLinkPermits } from "../../db/link-permits.js";
import { permitLinks, revokePermit } from "../../services/link-permit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerBlacklist(api) {
    api.get("/blacklist", channelAccessMiddleware, wrap(async (req, res) => res.json(await listBlacklist(channelOf(req)))));
    api.post("/blacklist", channelAccessMiddleware, wrap(async (req, res) => {
        const { word, action } = req.body;
        if (!word) return res.status(400).json({ error: "word ist Pflicht" });
        try {
            const ok = await addBlacklist(channelOf(req), word, Number(action ?? 0));
            invalidateBlacklistCache(channelOf(req));
            res.status(ok ? 201 : 409).json({ ok, error: ok ? undefined : "Eintrag existiert bereits" });
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    }));
    api.put("/blacklist/:word", channelAccessMiddleware, wrap(async (req, res) => {
        const action = Number(req.body.action);
        if (!Number.isInteger(action) || action < 0 || action > 10) return res.status(400).json({ error: "action muss 0-10 sein" });
        const ok = await updateBlacklist(channelOf(req), req.params.word, action);
        invalidateBlacklistCache(channelOf(req));
        res.status(ok ? 200 : 404).json({ ok });
    }));
    api.delete("/blacklist/:word", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await deleteBlacklist(channelOf(req), req.params.word);
        invalidateBlacklistCache(channelOf(req));
        res.status(ok ? 200 : 404).json({ ok });
    }));

    /* Link-Freigaben (Blacklist-Reiter): wer gerade Links posten darf */
    api.get("/link-permits", channelAccessMiddleware, wrap(async (req, res) => res.json(await listLinkPermits(channelOf(req)))));
    api.post("/link-permits", channelAccessMiddleware, wrap(async (req, res) => {
        const { username, minutes, untilOffline } = req.body;
        const channel = channelOf(req);
        const r = await permitLinks(channel, username, req.user?.username ?? "dashboard", untilOffline ? { untilOffline: true } : { seconds: Math.round(Number(minutes) * 60) });
        logAudit({ actor: req.user.username, action: "create", targetType: "link-permit", target: r.username, channel, details: { until: r.untilOffline ? "Stream-Ende" : `${Math.round(r.seconds / 60)} Min.` } });
        res.status(201).json({ ok: true });
    }));
    api.delete("/link-permits/:username", channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        const ok = await revokePermit(channel, req.params.username);
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "link-permit", target: req.params.username, channel, details: {} });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
