import { useCallback, useEffect, useRef, useState } from "react";
import { api, getIsOwner, getUserId, setSession, stashSessionForAuth } from "../api";
import { Collapsible, useList, useIsMobile, CardList } from "../components/common.jsx";

export const ROLE_LABELS = { owner: "Haupt-Admin", admin: "Admin", member: "Mitglied" };

export function Users() {
    const { rows, reload, error, setError } = useList("/users", "");
    const [allChannels, setAllChannels] = useState([]);
    const [form, setForm] = useState({ username: "", password: "", role: "member" });
    const [editing, setEditing] = useState(null); // { id, username, password, channels, role, isOwner }
    const [authChannel, setAuthChannel] = useState("");
    const [authBusy, setAuthBusy] = useState(false);
    const [tokenStatus, setTokenStatus] = useState([]);
    const [botStatus, setBotStatus] = useState(null);
    const isMobile = useIsMobile();
    const editRef = useRef(null);
    // Handy: Bearbeiten-Formular steht unter der Liste - nach dem Antippen dorthin scrollen
    useEffect(() => { if (editing?.id !== undefined) editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [editing?.id]);
    const iAmOwner = getIsOwner();
    const isAdminToken = getUserId() === 0; // Notfallzugang (WEB_ADMIN_TOKEN) - darf auch den Haupt-Administrator löschen
    // Wer darf wen löschen? Admin-Token: jeden (auch Haupt-Admin/ersten Benutzer) - Haupt-Admin: Admins und Mitglieder -
    // Admin: nur Mitglieder. Das eigene Konto nie (der Server prüft dasselbe noch einmal).
    const canDelete = (u) => {
        if (typeof u.canDelete === "boolean") return u.canDelete; // Antwort des Servers (gleiche Regeln)
        if (isAdminToken) return true;
        if (u.id === getUserId()) return false;
        if (iAmOwner) return !u.isOwner;
        return !u.isOwner && !u.isAdmin;
    };

    const loadTokenStatus = useCallback(() => {
        api("/twitch-auth/status").then((r) => { setTokenStatus(r.channels); setBotStatus(r.bot ?? null); }).catch((e) => setError(e.message));
    }, [setError]);

    useEffect(() => {
        api("/all-channels")
            .then((r) => {
                setAllChannels(r.channels);
                setAuthChannel((c) => c || r.channels[0] || "");
            })
            .catch((e) => setError(e.message));
        loadTokenStatus();
    }, [setError, loadTokenStatus]);

    async function authorizeBot() {
        setError("");
        setAuthBusy(true);
        try {
            const { url } = await api("/twitch-auth/bot-url");
            stashSessionForAuth();
            window.location.href = url;
        } catch (err) {
            setError(err.message);
            setAuthBusy(false);
        }
    }

    async function removeBot() {
        if (!confirm(`Bot-Account ${botStatus?.login ?? ""} wirklich entfernen? Moderationsaktionen laufen danach wieder über den Streamer-Token.`)) return;
        setError("");
        try {
            await api("/twitch-auth/bot", { method: "DELETE" });
            loadTokenStatus();
        } catch (err) {
            setError(err.message);
        }
    }

    async function authorize(e) {
        e.preventDefault();
        setError("");
        setAuthBusy(true);
        try {
            const { url } = await api("/twitch-auth/url", { channel: authChannel });
            stashSessionForAuth();
            window.location.href = url;
        } catch (err) {
            setError(err.message);
            setAuthBusy(false);
        }
    }

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/users", { method: "POST", body: form });
            setForm({ username: "", password: "", role: "member" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function save(e) {
        e.preventDefault();
        setError("");
        try {
            const body = { username: editing.username, role: editing.role };
            if (editing.password) body.password = editing.password;
            const updated = await api(`/users/${editing.id}`, { method: "PUT", body });
            // Eigenes Passwort geändert: der Server schickt ein neues Token, damit man angemeldet bleibt (alte Tokens sind ungültig)
            if (updated?.token) setSession(updated.token, updated.username, updated.isAdmin, updated.id, updated.isOwner);
            await api(`/users/${editing.id}/channels`, { method: "PUT", body: { channels: editing.channels } });
            setEditing(null);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(id) {
        if (!confirm("Diesen Benutzer wirklich löschen?")) return;
        try {
            await api(`/users/${id}`, { method: "DELETE" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    function toggleChannel(c) {
        setEditing((e) => {
            const has = e.channels.includes(c);
            return { ...e, channels: has ? e.channels.filter((x) => x !== c) : [...e.channels, c] };
        });
    }

    const channelLabel = (u) => (u.channels.length ? u.channels.join(", ") : "Alle");

    return (
        <section>
            <h2>Benutzer</h2>
            <p className="hint">
                Ohne ausgewählte Kanäle hat ein Benutzer Zugriff auf alle Kanäle.
                {!iAmOwner && " Nur der Haupt-Administrator kann die Admin-Rolle vergeben oder entziehen."}
            </p>

            <Collapsible title="Twitch-Autorisierung">
                <div className="panel">
                    <p className="hint">
                        Erzeugt (oder erneuert) den Twitch-API-Token für einen Kanal direkt über den Twitch-Login, statt ihn
                        manuell über ein externes Tool zu erzeugen und in die .env einzutragen. Dabei bitte mit dem
                        Streamer-Account des jeweiligen Kanals selbst einloggen – nicht mit dem Bot- oder einem Mod-Account,
                        sonst funktionieren einige Funktionen (z. B. Punkte-Rewards) nicht.
                    </p>
                    <form className="row" onSubmit={authorize}>
                        <label className="setting">
                            Kanal:
                            <select value={authChannel} onChange={(e) => setAuthChannel(e.target.value)}>
                                {allChannels.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </label>
                        <button type="submit" disabled={!authChannel || authBusy}>Anwendung autorisieren</button>
                    </form>
                    {isMobile ? (
                        <CardList rows={tokenStatus} rowKey={(t) => t.channel}
                            title={(t) => t.channel} meta={(t) => (t.hasToken ? "Token hinterlegt" : "Kein Token")}
                            details={(t) => <div><span className="hint">Broadcaster-ID: </span>{t.broadcasterId ?? "–"}</div>} />
                    ) : (
                        <table>
                            <thead><tr><th>Kanal</th><th>Status</th><th>Broadcaster-ID</th></tr></thead>
                            <tbody>
                                {tokenStatus.map((t) => (
                                    <tr key={t.channel}>
                                        <td>{t.channel}</td>
                                        <td>{t.hasToken ? "Token hinterlegt" : "Kein Token"}</td>
                                        <td>{t.broadcasterId ?? "–"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <h4>Bot-Account</h4>
                    <p className="hint">
                        Der Bot-Account führt Nachricht löschen, Timeout, Ban und den Follower-Modus bei !raid aus – in Twitchs
                        Moderationslog steht dann der Bot statt des Streamers. Dafür hier mit dem BOT-Account einloggen (er muss im
                        Kanal Moderator sein). Ohne autorisierten Bot-Account übernimmt weiter der Streamer-Token.
                    </p>
                    <div className="row">
                        <button type="button" onClick={authorizeBot} disabled={authBusy}>Bot-Account autorisieren</button>
                        {botStatus?.hasToken && (
                            <button type="button" className="danger" onClick={removeBot} disabled={authBusy}>Bot-Account entfernen</button>
                        )}
                        <span className="hint">
                            {botStatus?.hasToken ? `Aktuell: ${botStatus.login ?? botStatus.userId}` : "Noch kein Bot-Account autorisiert"}
                        </span>
                    </div>
                </div>
            </Collapsible>

            <form className="row" onSubmit={add}>
                <input placeholder="Benutzername" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                <input type="password" autoComplete="new-password" placeholder="Passwort (min. 8 Zeichen)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                <label className="setting">
                    Rolle:
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        <option value="member">Mitglied</option>
                        {iAmOwner && <option value="admin">Admin</option>}
                    </select>
                </label>
                <button type="submit">Anlegen</button>
            </form>
            {error && <p className="error">{error}</p>}
            {isMobile ? (
                <CardList rows={rows} rowKey={(u) => u.id}
                    title={(u) => u.username} meta={(u) => ROLE_LABELS[u.role] ?? "Mitglied"}
                    preview={(u) => `Kanäle: ${channelLabel(u)}`}
                    details={(u) => <div><span className="hint">Angelegt: </span>{new Date(u.created_at).toLocaleDateString("de-DE")}</div>}
                    actions={(u) => (
                        <>
                            <button onClick={() => setEditing({ id: u.id, username: u.username, password: "", channels: [...u.channels], role: u.role, isOwner: u.isOwner })}>Bearbeiten</button>
                            {canDelete(u) && <button className="danger" onClick={() => remove(u.id)}>Löschen</button>}
                        </>
                    )} />
            ) : (
                <table>
                    <thead><tr><th>Benutzername</th><th>Rolle</th><th>Kanäle</th><th>Angelegt</th><th></th></tr></thead>
                    <tbody>
                        {rows.map((u) => (
                            <tr key={u.id}>
                                <td>{u.username}</td>
                                <td>{ROLE_LABELS[u.role] ?? "Mitglied"}</td>
                                <td>{channelLabel(u)}</td>
                                <td>{new Date(u.created_at).toLocaleDateString("de-DE")}</td>
                                <td className="actions">
                                    <button onClick={() => setEditing({ id: u.id, username: u.username, password: "", channels: [...u.channels], role: u.role, isOwner: u.isOwner })}>Bearbeiten</button>
                                    {canDelete(u) && <button className="danger" onClick={() => remove(u.id)}>Löschen</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {editing && (
                <form className="panel" onSubmit={save} ref={editRef}>
                    <h3>Benutzer bearbeiten</h3>
                    <div className="row">
                        <input placeholder="Benutzername" value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} required />
                        <input type="password" autoComplete="new-password" placeholder="Neues Passwort (leer lassen für unverändert)" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} minLength={8} />
                        {editing.isOwner ? (
                            <span className="hint">Haupt-Administrator – Rolle kann nicht geändert werden.</span>
                        ) : (
                            <label className="setting">
                                Rolle:
                                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} disabled={!iAmOwner && editing.role !== "member"}>
                                    <option value="member">Mitglied</option>
                                    {iAmOwner && <option value="admin">Admin</option>}
                                </select>
                            </label>
                        )}
                    </div>
                    <p className="hint">Erlaubte Kanäle (keine Auswahl = Zugriff auf alle):</p>
                    <div className="row">
                        {allChannels.map((c) => (
                            <label key={c} className="setting">
                                <input type="checkbox" checked={editing.channels.includes(c)} onChange={() => toggleChannel(c)} /> {c}
                            </label>
                        ))}
                    </div>
                    <div className="row">
                        <button type="submit">Speichern</button>
                        <button type="button" onClick={() => setEditing(null)}>Abbrechen</button>
                    </div>
                </form>
            )}
        </section>
    );
}
