/** Dashboard-Routen: Eigene Identität und Benutzerverwaltung */
import { config } from "../../config.js";
import { setUserChannels } from "../../db/user-channels.js";
import { countUsers, listUsers, findByUsername, getUser, createUser, updateUser, deleteUser, isLastOwner } from "../../db/users.js";
import { logAudit } from "../../db/audit.js";
import { signToken } from "../auth.js";
import { isAdminUser, isOwnerUser, requireAdmin, wrap, forgetUser } from "../context.js";

export function registerUsers(api) {
    /* Eigene Identität (für die Anzeige im Dashboard, z. B. ob der Tab "Benutzer" sichtbar ist) */
    api.get("/me", wrap(async (req, res) => {
        res.json({
            id: req.user.id,
            username: req.user.username,
            isAdmin: await isAdminUser(req.user),
            isOwner: await isOwnerUser(req.user),
        });
    }));

    /*
     * Benutzerverwaltung (Dashboard-Zugänge) – nur für Admins/Owner sichtbar, außer man bearbeitet sich selbst.
     * Rollenhierarchie: owner (Haupt-Admin, genau einer) > admin > member.
     *  - Nur der Owner darf die Rolle "admin" vergeben oder entziehen.
     *  - Admins dürfen Benutzer anlegen/bearbeiten/Kanäle zuweisen, aber nur mit Rolle "member".
     *  - Die Rolle "owner" kann über die API nie vergeben werden (bleibt dem initialen Setup vorbehalten).
     */
    api.get("/users", requireAdmin, wrap(async (req, res) => {
        // Der Server sagt selbst, wen der Anfragende löschen darf (gleiche Regeln wie DELETE /users/:id), damit die
        // Oberfläche nicht auf zwischengespeicherte Rollen-Angaben im Browser angewiesen ist.
        const isToken = req.user.id === 0;
        const owner = await isOwnerUser(req.user);
        const users = await listUsers();
        res.json(users.map((u) => ({
            ...u,
            canDelete: isToken ? true : u.id === req.user.id ? false : owner ? !u.isOwner : !u.isOwner && !u.isAdmin,
        })));
    }));
    api.post("/users", requireAdmin, wrap(async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password || password.length < 8) {
            return res.status(400).json({ error: "Benutzername und ein Passwort mit mindestens 8 Zeichen sind Pflicht." });
        }
        const owner = await isOwnerUser(req.user);
        let role = req.body.role === "admin" || req.body.isAdmin ? "admin" : "member";
        if (role === "admin" && !owner) {
            return res.status(403).json({ error: "Nur der Haupt-Administrator kann die Admin-Rolle vergeben." });
        }
        const user = await createUser(username, password, role);
        if (!user) return res.status(409).json({ error: "Dieser Benutzername ist schon vergeben." });
        logAudit({ actor: req.user.username, action: "create", targetType: "user", target: user.username, details: { role } });
        res.status(201).json(user);
    }));
    api.put("/users/:id", wrap(async (req, res) => {
        const id = Number(req.params.id);
        const isSelf = req.user.id === id;
        const admin = await isAdminUser(req.user);
        const owner = await isOwnerUser(req.user);
        if (!isSelf && !admin) return res.status(403).json({ error: "Dafür sind Administratorrechte nötig." });

        // Konten von Haupt-Admin und Admins darf ein Admin NICHT verändern (Passwort/Name/Rolle) - sonst könnte er sich per
        // Passwort-Reset zum Haupt-Admin machen. Das dürfen nur der Haupt-Admin selbst bzw. jeder bei seinem eigenen Konto.
        if (!isSelf && !owner) {
            const target = await getUser(id);
            if (target && (target.isOwner || target.isAdmin)) {
                return res.status(403).json({ error: "Konten von Administratoren kann nur der Haupt-Administrator ändern." });
            }
        }
        const { username, password } = req.body;
        if (password && password.length < 8) return res.status(400).json({ error: "Das Passwort muss mindestens 8 Zeichen haben." });
        if (username) {
            const clash = await findByUsername(username);
            if (clash && clash.id !== id) return res.status(409).json({ error: "Dieser Benutzername ist schon vergeben." });
        }

        // Die Rolle darf nur ein Admin/Owner ändern, und zwischen "admin" und "member" nur der Owner.
        let roleUpdate;
        const requestedRole = req.body.role ?? (req.body.isAdmin !== undefined ? (req.body.isAdmin ? "admin" : "member") : undefined);
        if (requestedRole !== undefined && admin) {
            if (requestedRole === "owner") {
                return res.status(403).json({ error: "Die Rolle des Haupt-Administrators kann nicht vergeben werden." });
            }
            if (!owner && requestedRole !== "member") {
                return res.status(403).json({ error: "Nur der Haupt-Administrator kann die Admin-Rolle vergeben oder entziehen." });
            }
            const target = await getUser(id);
            if (target?.isOwner) {
                return res.status(400).json({ error: "Die Rolle des Haupt-Administrators kann nicht geändert werden." });
            }
            roleUpdate = requestedRole;
        }
        if (roleUpdate === "member" && (await isLastOwner(id))) {
            return res.status(400).json({ error: "Der Haupt-Administrator kann seine Rolle nicht abgeben." });
        }
        const user = await updateUser(id, { username, password, role: roleUpdate });
        if (!user) return res.status(404).json({ error: "Benutzer nicht gefunden." });
        logAudit({ actor: req.user.username, action: "edit", targetType: "user", target: user.username, details: { usernameChanged: !!username, passwordChanged: !!password, role: roleUpdate } });
        forgetUser(id); // neue Token-Version sofort gelten lassen
        // Ändert man sein EIGENES Passwort, bleibt man angemeldet: es gibt direkt ein neues Token dazu.
        if (password && req.user.id === id) return res.json({ ...user, token: signToken(user) });
        res.json(user);
    }));
    api.delete("/users/:id", requireAdmin, wrap(async (req, res) => {
        const id = Number(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: "Du kannst dich nicht selbst löschen." });
        // Der Admin-Token (Notfallzugang, req.user.id === 0) ist von den Lockout-Schutzmaßnahmen ausgenommen
        // und darf auch den letzten verbleibenden bzw. den erst angelegten (Haupt-)Benutzer löschen.
        const isAdminToken = req.user.id === 0;
        if (!isAdminToken && (await countUsers()) <= 1) return res.status(400).json({ error: "Der letzte Benutzer kann nicht gelöscht werden." });
        if (!isAdminToken && (await isLastOwner(id))) return res.status(400).json({ error: "Der Haupt-Administrator kann nicht gelöscht werden." });
        const target = await getUser(id);
        if (target && (target.isOwner || target.isAdmin) && !(await isOwnerUser(req.user))) {
            return res.status(403).json({ error: "Administrator-Konten kann nur der Haupt-Administrator löschen." });
        }
        const ok = await deleteUser(id);
        forgetUser(id); // gelöschter Benutzer: Anmelde-Token sofort ungültig
        if (ok) logAudit({ actor: req.user.username, action: "delete", targetType: "user", target: target?.username ?? String(id) });
        res.status(ok ? 200 : 404).json({ ok });
    }));

    api.put("/users/:id/channels", requireAdmin, wrap(async (req, res) => {
        const id = Number(req.params.id);
        const target = await getUser(id);
        if (!target) return res.status(404).json({ error: "Benutzer nicht gefunden." });
        const channels = Array.isArray(req.body.channels)
            ? [...new Set(req.body.channels.map((c) => String(c).toLowerCase()))].filter((c) => config.twitch.channels.includes(c))
            : [];
        await setUserChannels(id, channels);
        logAudit({
            actor: req.user.username,
            action: "edit",
            targetType: "user-channels",
            target: target.username,
            // "channel" (statt nur details) befüllen, damit die zugewiesenen Kanäle direkt in der Spalte "Kanal" stehen
            channel: channels.length ? channels.join(", ") : "alle",
            details: { channels: channels.length ? channels : "alle" },
        });
        res.json({ ok: true, channels });
    }));
}
