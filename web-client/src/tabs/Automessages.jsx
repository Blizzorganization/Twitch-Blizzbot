import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useChannelSettings, NumberSetting, BoolSetting, Collapsible, useIsMobile } from "../components/common.jsx";

export function Automessages({ channel }) {
    const [data, setData] = useState(null);
    const [text, setText] = useState("");
    const [delay, setDelay] = useState("");
    const [error, setError] = useState("");
    const [editing, setEditing] = useState(null); // { id, message, delay }
    const isMobile = useIsMobile();
    const [openId, setOpenId] = useState(null); // Handy: aufgeklappte Nachricht
    const { settings, patch: patchSettings } = useChannelSettings(channel);

    const reload = useCallback(() => {
        api("/automessages", { channel }).then(setData).catch((e) => setError(e.message));
    }, [channel]);
    useEffect(reload, [reload]);

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/automessages", { method: "POST", channel, body: { message: text, delayMinutes: delay ? Number(delay) : null } });
            setText("");
            setDelay("");
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function toggle() {
        await api("/automessages/enabled", { method: "PUT", channel, body: { enabled: !data.enabled } });
        reload();
    }

    async function saveDelay(id, value) {
        try {
            await api(`/automessages/${id}`, { method: "PUT", channel, body: { delayMinutes: value ? Number(value) : 0 } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function saveStandalone(id, value) {
        try {
            await api(`/automessages/${id}`, { method: "PUT", channel, body: { standalone: value } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function saveEdit(e) {
        e.preventDefault();
        setError("");
        try {
            await api(`/automessages/${editing.id}`, { method: "PUT", channel, body: { message: editing.message } });
            setEditing(null);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(id) {
        await api(`/automessages/${id}`, { method: "DELETE", channel });
        reload();
    }

    if (!data) return <p>Lade ...</p>;
    return (
        <section>
            <h2>Automessages</h2>
            <p>
                Status: <strong>{data.enabled ? "an" : "aus"}</strong>{" "}
                <button onClick={toggle}>{data.enabled ? "Ausschalten" : "Einschalten"}</button>
            </p>
            {settings && (
                <Collapsible title="Automessage-Einstellungen">
                    <div className="panel settings-panel">
                        <NumberSetting label="Standard-Intervall (Minuten, 0 = aus)" field={settings.automessageDelay}
                            onChange={(v) => patchSettings({ automessageDelay: v })} onReset={() => patchSettings({ automessageDelay: null })} />
                        <BoolSetting label="Nur senden, wenn der Kanal live ist" field={settings.automessageOnlyLive}
                            onChange={(v) => patchSettings({ automessageOnlyLive: v })} onReset={() => patchSettings({ automessageOnlyLive: null })} />
                        <NumberSetting label="Nur senden ab Zuschauerzahl (0 = egal)" field={settings.automessageMinViewers}
                            onChange={(v) => patchSettings({ automessageMinViewers: v })} onReset={() => patchSettings({ automessageMinViewers: null })} />
                        <NumberSetting label="Nur senden, wenn seit der letzten Automessage mind. so viele Chat-Nachrichten kamen (0 = egal)" field={settings.automessageMinChatMessages}
                            onChange={(v) => patchSettings({ automessageMinChatMessages: v })} onReset={() => patchSettings({ automessageMinChatMessages: null })} />
                    </div>
                </Collapsible>
            )}
            <p className="hint">
                Jede Nachricht kann ein eigenes Intervall bekommen (Wartezeit, bis danach die nächste Nachricht kommt) – leer lassen,
                um das Standard-Intervall oben zu verwenden. Mit „Einzeln" läuft eine Nachricht mit eigenem Timer unabhängig von den anderen (sie wird aus der Reihum-Liste herausgenommen und nutzt ihr Intervall bzw. das Standard-Intervall).
            </p>
            <form className="row" onSubmit={add}>
                <input className="grow" placeholder="Neue Nachricht" value={text} onChange={(e) => setText(e.target.value)} required />
                <input type="number" min="0" title="Eigenes Intervall in Minuten (leer = Standard)" placeholder="Standard" value={delay} onChange={(e) => setDelay(e.target.value)} />
                <button type="submit">Hinzufügen</button>
            </form>
            {error && <p className="error">{error}</p>}
            {isMobile ? (
                <div className="cmd-list">
                    {data.messages.map((m, i) => {
                        const open = openId === m.id;
                        return (
                            <div key={m.id} className={"cmd-card" + (open ? " open" : "")}>
                                <div className="cmd-card-head" onClick={() => setOpenId(open ? null : m.id)}>
                                    <span className={"collapsible-arrow" + (open ? " open" : "")}>▶</span>
                                    <strong>#{i + 1}</strong>
                                    <span className="cmd-meta">{m.delay_minutes ? `${m.delay_minutes} Min.` : "Standard"}{m.standalone ? " · einzeln" : ""}</span>
                                </div>
                                <p className="cmd-response" onClick={() => setOpenId(open ? null : m.id)}>{m.message}</p>
                                {open && (
                                    <>
                                        <label className="cmd-field">Intervall (Min.)
                                            <input type="number" min="0" placeholder="Standard" defaultValue={m.delay_minutes || ""} onBlur={(e) => saveDelay(m.id, e.target.value)} />
                                        </label>
                                        <label className="cmd-field" title="Einzeln: eigener Timer statt Reihum-Liste">
                                            <span><input type="checkbox" checked={!!m.standalone} onChange={(e) => saveStandalone(m.id, e.target.checked)} /> Läuft einzeln (eigener Timer)</span>
                                        </label>
                                        <div className="cmd-actions">
                                            <button onClick={() => { setEditing({ id: m.id, message: m.message }); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Bearbeiten</button>
                                            <button className="danger" onClick={() => remove(m.id)}>Löschen</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <table>
                    <thead><tr><th>#</th><th>Nachricht</th><th>Intervall (Min.)</th><th title="Eigener Timer statt Reihum-Liste">Einzeln</th><th></th></tr></thead>
                    <tbody>
                        {data.messages.map((m, i) => (
                            <tr key={m.id}>
                                <td>{i + 1}</td>
                                <td>{m.message}</td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        className="automessage-delay"
                                        title="Eigenes Intervall in Minuten (0/leer = Standard)"
                                        placeholder="Standard"
                                        defaultValue={m.delay_minutes || ""}
                                        onBlur={(e) => saveDelay(m.id, e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input type="checkbox" title="Läuft einzeln mit eigenem Timer (sonst reihum mit den anderen)" checked={!!m.standalone} onChange={(e) => saveStandalone(m.id, e.target.checked)} />
                                </td>
                                <td className="actions">
                                    <button onClick={() => setEditing({ id: m.id, message: m.message })}>Bearbeiten</button>
                                    <button className="danger" onClick={() => remove(m.id)}>Löschen</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {editing && (
                <form className="panel" onSubmit={saveEdit}>
                    <h3>Nachricht bearbeiten</h3>
                    <textarea value={editing.message} onChange={(e) => setEditing({ ...editing, message: e.target.value })} required />
                    <div className="row">
                        <button type="submit">Speichern</button>
                        <button type="button" onClick={() => setEditing(null)}>Abbrechen</button>
                    </div>
                </form>
            )}
        </section>
    );
}
