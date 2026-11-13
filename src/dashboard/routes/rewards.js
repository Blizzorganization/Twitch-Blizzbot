/** Dashboard-Routen: Punkte-Rewards (Channel Points) */
import { createReward, removeReward, listAllRewards, listAllRedemptions } from "../../services/channel-reward.js";
import { logAudit } from "../../db/audit.js";
import { wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerRewards(api) {
    /* Punkte-Rewards (Channel Points, nur vom Bot selbst angelegte Rewards, siehe README) */
    api.get("/channel-rewards", channelAccessMiddleware, wrap(async (req, res) => res.json(await listAllRewards(channelOf(req)))));
    api.post("/channel-rewards", channelAccessMiddleware, wrap(async (req, res) => {
        const { title, cost, prompt, userInputRequired } = req.body;
        const r = await createReward(channelOf(req), { title, cost, prompt, userInputRequired });
        logAudit({ actor: req.user.username, action: "create", targetType: "channel-reward", target: title, channel: channelOf(req), details: { cost } });
        res.status(201).json(r);
    }));
    api.delete("/channel-rewards/:id", channelAccessMiddleware, wrap(async (req, res) => {
        const ok = await removeReward(channelOf(req), Number(req.params.id));
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "channel-reward", target: String(req.params.id), channel: channelOf(req) });
        res.status(ok ? 200 : 404).json({ ok });
    }));
    api.get("/channel-rewards/redemptions", channelAccessMiddleware, wrap(async (req, res) => res.json(await listAllRedemptions(channelOf(req)))));
}
