/** Dashboard-Routen: Verify-Mods */
import { logAudit } from "../../db/audit.js";
import { listBotMods, addBotMod, removeBotMod } from "../../db/bot-mods.js";
import { requireAdmin, wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerVerifyMods(api) {
    /* Verify-Mods (ergänzen mods.txt bzw. das Twitch-Mod-Abzeichen) - nur für Admins */
    api.get("/bot-mods", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => res.json(await listBotMods(channelOf(req)))));
    api.post("/bot-mods", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const username = String(req.body.username ?? "").trim().replace(/^@/, "").toLowerCase();
        if (!/^[a-z0-9_]{1,25}$/.test(username)) return res.status(400).json({ error: "Bitte einen gültigen Twitch-Namen angeben (nur Buchstaben, Zahlen, _)." });
        const { added } = await addBotMod(channelOf(req), username, req.user.username);
        if (added) logAudit({ actor: req.user.username, action: "create", targetType: "bot-mod", target: username, channel: channelOf(req) });
        res.status(added ? 201 : 409).json(added ? { ok: true } : { error: "Dieser Nutzer ist schon eingetragen." });
    }));
    api.delete("/bot-mods/:username", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const ok = await removeBotMod(channelOf(req), req.params.username);
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "bot-mod", target: req.params.username, channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
}
