/** Dashboard-Routen: Alerts (Sub/Resub/Bits/Raid/Follow ...) */
import { ALERT_TYPES, formatAlert, listAlertTemplates, setAlertTemplate, resetAlertTemplate, setAlertEnabled, setAlertAsAction } from "../../db/alerts.js";
import { announce } from "../../services/announce.js";
import { logAudit } from "../../db/audit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerAlerts(api) {
    /* Alerts (Sub/Resub/Bits/Raid/Gift-Texte) */
    api.get("/alerts", channelAccessMiddleware, wrap(async (req, res) => res.json(await listAlertTemplates(channelOf(req)))));
    api.put("/alerts/:type", channelAccessMiddleware, wrap(async (req, res) => {
        const { type } = req.params;
        if (!(type in ALERT_TYPES)) return res.status(404).json({ error: "Unbekannter Alert-Typ" });
        const template = String(req.body.template ?? "").trim();
        if (!template) return res.status(400).json({ error: "template darf nicht leer sein" });
        await setAlertTemplate(channelOf(req), type, template);
        res.json({ ok: true });
    }));
    api.delete("/alerts/:type", channelAccessMiddleware, wrap(async (req, res) => {
        await resetAlertTemplate(channelOf(req), req.params.type);
        res.json({ ok: true });
    }));
    api.put("/alerts/:type/enabled", channelAccessMiddleware, wrap(async (req, res) => {
        const { type } = req.params;
        if (!(type in ALERT_TYPES)) return res.status(404).json({ error: "Unbekannter Alert-Typ" });
        await setAlertEnabled(channelOf(req), type, !!req.body.enabled);
        logAudit({
            actor: req.user.username,
            action: "edit",
            targetType: "alert",
            target: type,
            channel: channelOf(req),
            details: { enabled: !!req.body.enabled },
        });
        res.json({ ok: true });
    }));
    api.put("/alerts/:type/action", channelAccessMiddleware, wrap(async (req, res) => {
        const { type } = req.params;
        if (!(type in ALERT_TYPES)) return res.status(404).json({ error: "Unbekannter Alert-Typ" });
        await setAlertAsAction(channelOf(req), type, !!req.body.asAction);
        logAudit({ actor: req.user.username, action: "edit", targetType: "alert", target: type, channel: channelOf(req), details: { asAction: !!req.body.asAction } });
        res.json({ ok: true });
    }));
    api.post("/alerts/:type/test", channelAccessMiddleware, wrap(async (req, res) => {
        const { type } = req.params;
        const def = ALERT_TYPES[type];
        if (!def) return res.status(404).json({ error: "Unbekannter Alert-Typ" });
        const channel = channelOf(req);
        const current = (await listAlertTemplates(channel)).find((a) => a.type === type);
        announce(channel, formatAlert(current.template, def.sample), current.asAction);
        res.json({ ok: true });
    }));
}
