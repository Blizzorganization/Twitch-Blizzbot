/** Dashboard-Routen: Automessages */
import { listAutomessages, addAutomessage, updateAutomessage, deleteAutomessage, setAutomessageEnabled, isAutomessageEnabled } from "../../db/automessages.js";
import { getChannelSettings } from "../../db/channel-settings.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerAutomessages(api) {
    /* Automessages */
    api.get("/automessages", channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        res.json({
            enabled: await isAutomessageEnabled(channel),
            delayMinutes: (await getChannelSettings(channel)).automessageDelay,
            messages: await listAutomessages(channel),
        });
    }));
    api.post("/automessages", channelAccessMiddleware, wrap(async (req, res) => {
        const message = String(req.body.message ?? "").trim();
        if (!message) return res.status(400).json({ error: "message ist Pflicht" });
        const delayMinutes = req.body.delayMinutes !== undefined ? Number(req.body.delayMinutes) || null : null;
        res.status(201).json({ ok: true, id: await addAutomessage(channelOf(req), message, delayMinutes) });
    }));
    api.put("/automessages/enabled", channelAccessMiddleware, wrap(async (req, res) => {
        await setAutomessageEnabled(channelOf(req), !!req.body.enabled);
        res.json({ ok: true });
    }));
    api.put("/automessages/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const body = {};
        if (req.body.message !== undefined) body.message = String(req.body.message).trim();
        if (req.body.delayMinutes !== undefined) body.delayMinutes = Number(req.body.delayMinutes) || null;
        if (req.body.standalone !== undefined) body.standalone = !!req.body.standalone;
        const ok = await updateAutomessage(channelOf(req), Number(req.params.id), body);
        res.status(ok ? 200 : 404).json({ ok });
    }));
    api.delete("/automessages/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await deleteAutomessage(channelOf(req), Number(req.params.id));
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
