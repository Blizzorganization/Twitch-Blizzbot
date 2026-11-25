/** Dashboard-Routen: Sicherung: Export/Import der Kanal-Daten */
import { invalidateBlacklistCache } from "../../db/blacklist.js";
import { syncLevelingState } from "../../services/leveling.js";
import { logAudit } from "../../db/audit.js";
import { invalidateGreetings } from "../../services/greeting.js";
import { exportChannel, importChannel, BACKUP_SECTIONS } from "../../db/backup.js";
import { requireAdmin, wrap, channelOf, channelAccessMiddleware } from "../context.js";

export function registerBackup(api) {
    /* Sicherung: Export/Import der Kanal-Daten (nur Admins) */
    api.get("/backup/sections", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => res.json(BACKUP_SECTIONS)));
    api.get("/backup/export", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const backup = await exportChannel(channelOf(req));
        logAudit({ actor: req.user.username, action: "export", targetType: "backup", target: channelOf(req), channel: channelOf(req) });
        res.json(backup);
    }));
    api.post("/backup/import", channelAccessMiddleware, requireAdmin, wrap(async (req, res) => {
        const { backup, mode, sections, dryRun } = req.body ?? {};
        const out = await importChannel(channelOf(req), backup, { mode, sections: Array.isArray(sections) ? sections : undefined, dryRun: !!dryRun });
        if (!out.dryRun) {
            invalidateBlacklistCache(channelOf(req));
            invalidateGreetings(channelOf(req));
            if (out.sections.includes("settings")) await syncLevelingState(channelOf(req));
            logAudit({ actor: req.user.username, action: "import", targetType: "backup", target: channelOf(req), channel: channelOf(req), details: { mode: out.mode, sections: out.sections, result: out.result } });
        }
        res.json(out);
    }));
}
