/** Dashboard-Routen: Audit-Log */
import { listAuditLog } from "../../db/audit.js";
import { requireAdmin, wrap } from "../context.js";

export function registerAudit(api) {
    /* Audit-Log (nur Admins/Owner) – protokolliert Command-/Alias-/Counter-/Benutzer-Verwaltung.
       Einträge älter als 3 Tage werden automatisch gelöscht (siehe index.js); zum Blättern Seiten à 30. */
    api.get("/audit-log", requireAdmin, wrap(async (req, res) => {
        const limit = Number(req.query.limit) || 30;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const { rows, total } = await listAuditLog(limit, (page - 1) * limit, {
            q: typeof req.query.q === "string" ? req.query.q : "",
            action: typeof req.query.action === "string" ? req.query.action : "",
            type: typeof req.query.type === "string" ? req.query.type : "",
        });
        res.json({ rows, total, page, limit });
    }));
}
