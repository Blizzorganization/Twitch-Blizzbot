import { useState } from "react";
import { api } from "../api";
import { useList, useChannelSettings, NumberSetting, Collapsible } from "../components/common.jsx";

export function Alerts({ channel }) {
    const { rows, reload, error, setError } = useList("/alerts", channel);
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    const [drafts, setDrafts] = useState({});

    const draftFor = (a) => drafts[a.type] ?? a.template;

    async function save(a) {
        setError("");
        try {
            await api(`/alerts/${a.type}`, { method: "PUT", channel, body: { template: draftFor(a) } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function reset(a) {
        try {
            await api(`/alerts/${a.type}`, { method: "DELETE", channel });
            setDrafts((d) => { const next = { ...d }; delete next[a.type]; return next; });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function test(a) {
        try {
            await api(`/alerts/${a.type}/test`, { method: "POST", channel, body: { template: draftFor(a) } });
        } catch (err) {
            setError(err.message);
        }
    }

    async function toggle(a) {
        try {
            await api(`/alerts/${a.type}/enabled`, { method: "PUT", channel, body: { enabled: !a.enabled } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function toggleAction(a) {
        try {
            await api(`/alerts/${a.type}/action`, { method: "PUT", channel, body: { asAction: !a.asAction }, toast: a.asAction ? "Wird als normale Nachricht gesendet" : "Wird als /me gesendet" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>Alerts</h2>
            <p className="hint">Texte für Sub, Resub, Bits, Raid und Gift-Subs. Platzhalter in geschweiften Klammern werden beim Senden ersetzt. Einzelne Alerts lassen sich hier auch deaktivieren. Standardmäßig kommen sie als normale Chatnachricht; wer die farbige /me-Darstellung möchte, schaltet sie pro Alert zu.</p>
            {error && <p className="error">{error}</p>}
            {settings && (
                <Collapsible title="Follow-Alert: Schutz vor Follower-Bots">
                    <div className="panel settings-panel">
                        <p className="hint">
                            Kommen innerhalb des Zeitfensters mehr Follower als erlaubt (z. B. nach einem Raid oder durch Follower-Bots),
                            schweigt der Alert, bis es wieder ruhiger wird. Derselbe Nutzer löst höchstens einmal pro Stunde aus.
                        </p>
                        <NumberSetting label="Höchstens so viele Follower …" field={settings.followAlertMax}
                            hint="0 = keine Begrenzung"
                            onChange={(v) => patchSettings({ followAlertMax: v })} onReset={() => patchSettings({ followAlertMax: null })} />
                        <NumberSetting label="… innerhalb von (Sekunden)" field={settings.followAlertWindowSeconds}
                            onChange={(v) => patchSettings({ followAlertWindowSeconds: v })} onReset={() => patchSettings({ followAlertWindowSeconds: null })} />
                    </div>
                </Collapsible>
            )}
            {rows.map((a) => (
                <div className="panel" key={a.type}>
                    <h3>
                        {a.label}{a.isCustom && <span className="hint"> (angepasst)</span>}
                        {!a.enabled && <span className="hint"> (deaktiviert)</span>}
                    </h3>
                    <p className="hint">Platzhalter: {a.placeholders.map((p) => `{${p}}`).join(", ")}</p>
                    <textarea
                        rows={2}
                        value={draftFor(a)}
                        onChange={(e) => setDrafts((d) => ({ ...d, [a.type]: e.target.value }))}
                        disabled={!a.enabled}
                    />
                    <label className="setting">
                        <input type="checkbox" checked={!!a.asAction} onChange={() => toggleAction(a)} disabled={!a.enabled} /> Als /me senden (farbig/kursiv)
                    </label>
                    <div className="row">
                        <button onClick={() => save(a)} disabled={!a.enabled}>Speichern</button>
                        <button onClick={() => test(a)} disabled={!a.enabled}>Testen (im Chat senden)</button>
                        {a.isCustom && <button className="danger" onClick={() => reset(a)}>Auf Standard zurücksetzen</button>}
                        <button onClick={() => toggle(a)}>{a.enabled ? "Deaktivieren" : "Aktivieren"}</button>
                    </div>
                </div>
            ))}
        </section>
    );
}
