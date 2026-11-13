/** Dashboard-Routen: Begrüßungen */
import { logAudit } from "../../db/audit.js";
import { listGreetings, saveGreeting, setGreetingEnabled, deleteGreeting } from "../../db/greetings.js";
import { invalidateGreetings } from "../../services/greeting.js";
import { requireAdmin, wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerGreetings(api) {
    /* Begrüßungen: bestimmte Nutzer werden bei ihrer ersten Nachricht im Stream vom Bot begrüßt */
    api.get("/greetings", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => res.json(await listGreetings(channelOf(req)))));
    api.post("/greetings", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const username = String(req.body.username ?? "").trim().replace(/^@/, "").toLowerCase();
        const message = String(req.body.message ?? "").trim();
        if (!/^[a-z0-9_]{1,25}$/.test(username)) return res.status(400).json({ error: "Bitte einen gültigen Twitch-Namen angeben (nur Buchstaben, Zahlen, _)." });
        if (!message || message.length > 400) return res.status(400).json({ error: "Der Text ist Pflicht und darf höchstens 400 Zeichen lang sein." });
        await saveGreeting(channelOf(req), username, message);
        invalidateGreetings(channelOf(req));
        logAudit({ actor: req.user.username, action: "edit", targetType: "greeting", target: username, channel: channelOf(req), details: { message } });
        res.status(201).json({ ok: true });
    }));
    api.put("/greetings/:username/enabled", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const ok = await setGreetingEnabled(channelOf(req), req.params.username, !!req.body.enabled);
        invalidateGreetings(channelOf(req));
        if (ok) logAudit({ actor: req.user.username, action: "edit", targetType: "greeting", target: req.params.username, channel: channelOf(req), details: { enabled: !!req.body.enabled } });
        res.status(ok ? 200 : 404).json({ ok });
    }));
    api.delete("/greetings/:username", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const ok = await deleteGreeting(channelOf(req), req.params.username);
        invalidateGreetings(channelOf(req));
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "greeting", target: req.params.username, channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
