/** Dashboard-Routen: Zitate */
import { logAudit } from "../../db/audit.js";
import { listQuotes, addQuote, deleteQuote } from "../../db/quotes.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerQuotes(api) {
    /* Zitate */
    api.get("/quotes", channelAccessMiddleware, wrap(async (req, res) => res.json(await listQuotes(channelOf(req)))));
    api.post("/quotes", channelAccessMiddleware, wrap(async (req, res) => {
        const text = String(req.body.text ?? "").trim();
        if (!text) return res.status(400).json({ error: "text ist Pflicht" });
        const q = await addQuote(channelOf(req), text, req.user.username);
        logAudit({ actor: req.user.username, action: "create", targetType: "quote", target: String(q.id), channel: channelOf(req), details: { text } });
        res.status(201).json(q);
    }));
    api.delete("/quotes/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await deleteQuote(channelOf(req), Number(req.params.id));
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "quote", target: req.params.id, channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
