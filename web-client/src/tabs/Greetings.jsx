import { useState } from "react";
import { api } from "../api";
import { useList, useChannelSettings, FilterBar, matchesQuery, useIsMobile, CardList, MobileHint } from "../components/common.jsx";

/** Chat → Begrüßungen: Der Bot begrüßt hinterlegte Nutzer bei ihrer ersten Nachricht im laufenden Stream. */
export function Greetings({ channel }) {
    const { rows, reload, error, setError } = useList("/greetings", channel);
    const empty = { username: "", message: "Willkommen im Stream, {user}!" };
    const [form, setForm] = useState(empty);
    const [editing, setEditing] = useState(null); // Nutzername, solange einer bearbeitet wird
    const [query, setQuery] = useState("");
    const isMobile = useIsMobile();
    const { settings, patch } = useChannelSettings(channel);
    const active = settings ? settings.greetingsEnabled.value : true;
    const shownRows = rows.filter((r) => matchesQuery(query, r.username, r.message));

    async function save(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/greetings", { method: "POST", channel, body: form, toast: "Gespeichert" });
            setForm(empty);
            setEditing(null);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function toggle(r) {
        try {
            await api(`/greetings/${encodeURIComponent(r.username)}/enabled`, { method: "PUT", channel, body: { enabled: !r.enabled } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(r) {
        if (!confirm(`Begrüßung für ${r.username} wirklich löschen?`)) return;
        try {
            await api(`/greetings/${encodeURIComponent(r.username)}`, { method: "DELETE", channel });
            if (editing === r.username) { setEditing(null); setForm(empty); }
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    const startEdit = (r) => { setEditing(r.username); setForm({ username: r.username, message: r.message }); window.scrollTo({ top: 0, behavior: "smooth" }); };

    return (
        <section>
            <h2>Begrüßungen</h2>
            {settings && (
                <p>
                    Status: <strong>{active ? "an" : "aus"}</strong>{" "}
                    <button onClick={() => patch({ greetingsEnabled: !active })}>{active ? "Ausschalten" : "Einschalten"}</button>
                </p>
            )}
            <MobileHint>
                <p className="hint">
                    Schreibt einer der hier eingetragenen Nutzer zum ersten Mal in einem laufenden Stream, antwortet der Bot sofort mit dem
                    hinterlegten Text (pro Nutzer höchstens einmal pro Stream, nicht wenn der Kanal offline ist). Platzhalter: <code>{"{user}"}</code> = Name des Nutzers.
                </p>
            </MobileHint>
            <form className="row" onSubmit={save}>
                <input placeholder="Twitch-Name" value={form.username} disabled={!!editing} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                <input className="grow" placeholder="Text, z. B. Willkommen im Stream, {user}!" value={form.message} maxLength={400} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
                <button type="submit">{editing ? "Speichern" : "Hinzufügen"}</button>
                {editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>Abbrechen</button>}
            </form>
            {error && <p className="error">{error}</p>}
            <FilterBar query={query} setQuery={setQuery} shown={shownRows.length} total={rows.length} active={!!query}
                onClear={() => setQuery("")} placeholder="Nutzer oder Text suchen ..." />
            {isMobile ? (
                <CardList rows={shownRows} rowKey={(r) => r.username}
                    title={(r) => r.username} meta={(r) => (r.enabled ? "Aktiv" : "Aus")} preview={(r) => r.message}
                    actions={(r) => (
                        <>
                            <button onClick={() => toggle(r)}>{r.enabled ? "Ausschalten" : "Einschalten"}</button>
                            <button onClick={() => startEdit(r)}>Bearbeiten</button>
                            <button className="danger" onClick={() => remove(r)}>Löschen</button>
                        </>
                    )} />
            ) : (
                <table>
                    <thead><tr><th>Nutzer</th><th>Text</th><th>Aktiv</th><th></th></tr></thead>
                    <tbody>
                        {shownRows.map((r) => (
                            <tr key={r.username} className={r.enabled ? "" : "disabled"}>
                                <td>{r.username}</td>
                                <td>{r.message}</td>
                                <td><input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} /></td>
                                <td className="actions">
                                    <button onClick={() => startEdit(r)}>Bearbeiten</button>
                                    <button className="danger" onClick={() => remove(r)}>Löschen</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
