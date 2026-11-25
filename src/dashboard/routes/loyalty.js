/** Dashboard-Routen: Loyalty-System: Level/XP, Punkte, Watchtime */
import { topXp, topPoints, grantPoints, grantXp, resetXp, resetPoints } from "../../db/leveling.js";
import { watchtimeList, currentMonth, setWatchtime, monthKeysBetween } from "../../db/watchtime.js";
import { logAudit } from "../../db/audit.js";
import { requireAdmin, wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerLoyalty(api) {
    /* Loyalty-System: Level-/XP- und Punkte-Ranglisten + manuelle Punkte-Vergabe durchs Dashboard */
    api.get("/leveling/top", channelAccessMiddleware, wrap(async (req, res) => {
        const channel = channelOf(req);
        res.json({ xp: await topXp(channel, 10), points: await topPoints(channel, 10) });
    }));
    api.post("/leveling/reset-xp", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const channel = channelOf(req);
        const users = await resetXp(channel);
        logAudit({ actor: req.user.username, action: "delete", targetType: "xp", target: "alle", channel, details: { users } });
        res.json({ ok: true, users });
    }));
    api.post("/leveling/reset-points", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const channel = channelOf(req);
        const users = await resetPoints(channel);
        logAudit({ actor: req.user.username, action: "delete", targetType: "points", target: "alle", channel, details: { users } });
        res.json({ ok: true, users });
    }));
    api.post("/leveling/points", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const username = String(req.body.username ?? "").trim().toLowerCase();
        const amount = Math.floor(Number(req.body.amount));
        if (!username || !Number.isFinite(amount)) return res.status(400).json({ error: "username und amount sind Pflicht" });
        const points = await grantPoints(channelOf(req), username, username, amount);
        logAudit({ actor: req.user.username, action: "edit", targetType: "points", target: username, channel: channelOf(req), details: { amount, points } });
        res.json({ ok: true, points });
    }));

    api.post("/leveling/xp", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const username = String(req.body.username ?? "").trim().toLowerCase();
        const amount = Math.floor(Number(req.body.amount));
        if (!username || !Number.isFinite(amount)) return res.status(400).json({ error: "username und amount sind Pflicht" });
        const { xp, level } = await grantXp(channelOf(req), username, username, amount);
        logAudit({ actor: req.user.username, action: "edit", targetType: "xp", target: username, channel: channelOf(req), details: { amount, xp, level } });
        res.json({ ok: true, xp, level });
    }));

    /* Loyalty-System: Watchtime-Übersicht aller Nutzer (Unterreiter "Watchtime") */
    api.get("/watchtime-list", channelAccessMiddleware, wrap(async (req, res) => {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = 20;
        let month = req.query.month === "month" ? currentMonth() : "alltime";
        if (req.query.month === "range") {
            // Zeitspanne: Monatswerte von "from" bis "to" (YYYY-MM) werden addiert
            month = monthKeysBetween(String(req.query.from ?? ""), String(req.query.to ?? ""));
            if (!month) return res.status(400).json({ error: "Ungültige Zeitspanne (Von muss vor oder gleich Bis liegen, höchstens 10 Jahre)." });
        }
        const rows = await watchtimeList(channelOf(req), month, limit, page, String(req.query.q ?? "").slice(0, 25));
        res.json({ rows, page });
    }));
    /** Watchtime eines Nutzers setzen (Gesamt oder aktueller Monat) - nur Admins. Body: { month: "alltime" | "month", minutes } */
    api.put("/watchtime/:viewer", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const viewer = String(req.params.viewer ?? "").trim().replace(/^@/, "").toLowerCase();
        if (!/^[a-z0-9_]{1,25}$/.test(viewer)) return res.status(400).json({ error: "Ungültiger Twitch-Name." });
        const minutes = Number(req.body.minutes);
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 6_000_000) return res.status(400).json({ error: "Die Watchtime muss zwischen 0 und 6.000.000 Minuten liegen." });
        const monthKey = req.body.month === "month" ? currentMonth() : "alltime";
        const r = await setWatchtime(channelOf(req), viewer, monthKey, Math.round(minutes * 2)); // 1 Einheit = 30 s
        logAudit({ actor: req.user.username, action: "edit", targetType: "watchtime", target: viewer, channel: channelOf(req), details: { period: monthKey, from: `${r.old / 2} min`, to: `${r.new / 2} min` } });
        res.json({ ok: true, ...r });
    }));
}
