import { useCallback, useEffect, useRef, useState } from "react";
import { api, toast, getIsAdmin } from "../api";
import { useChannelSettings, NumberSetting, DecimalSetting, Collapsible, MobileHint, StatusToggle } from "../components/common.jsx";

/** Reiter "Loyalty System" mit den Unterpunkten "Level/Punkte" und "Watchtime". */
export function LoyaltySection({ channel }) {
    const [sub, setSub] = useState("Level/Punkte");
    const SUBS = ["Level/Punkte", "Watchtime"];
    return (
        <div>
            <div className="subnav">
                {SUBS.map((s) => (
                    <button key={s} className={s === sub ? "active" : ""} onClick={() => setSub(s)}>{s}</button>
                ))}
            </div>
            {sub === "Level/Punkte" && <LevelPunkte channel={channel} />}
            {sub === "Watchtime" && <WatchtimeOverview channel={channel} />}
        </div>
    );
}

/** Unterpunkt "Level/Punkte": Einstellungen für das XP-/Level- und das Punkte-System + Ranglisten. */
export function LevelPunkte({ channel }) {
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    const [top, setTop] = useState({ xp: [], points: [] });
    const [error, setError] = useState("");
    const isAdmin = getIsAdmin(); // Zurücksetzen und Vergeben/Entziehen nur für Admins
    const [grant, setGrant] = useState({ username: "", amount: 100 });
    const [grantXp, setGrantXp] = useState({ username: "", amount: 100 });

    const reload = useCallback(() => {
        api("/leveling/top", { channel }).then(setTop).catch((e) => setError(e.message));
    }, [channel]);
    useEffect(reload, [reload]);

    async function resetLevels() {
        if (!confirm("XP und Level ALLER Nutzer in diesem Kanal wirklich auf 0 zurücksetzen? Das kann nicht rückgängig gemacht werden. Punkte bleiben erhalten. Nutzer, die danach weder XP noch Punkte haben, werden aus der Tabelle gelöscht.")) return;
        setError("");
        try {
            await api("/leveling/reset-xp", { method: "POST", channel, toast: "Level/XP zurückgesetzt" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function resetAllPoints() {
        if (!confirm("Die Punkte ALLER Nutzer in diesem Kanal wirklich auf 0 zurücksetzen? Das kann nicht rückgängig gemacht werden. XP und Level bleiben erhalten. Nutzer, die danach weder XP noch Punkte haben, werden aus der Tabelle gelöscht.")) return;
        setError("");
        try {
            await api("/leveling/reset-points", { method: "POST", channel, toast: "Punkte zurückgesetzt" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function givePoints(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/leveling/points", { method: "POST", channel, body: grant, toast: "Punkte aktualisiert" });
            setGrant({ ...grant, username: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function giveXp(e) {
        e.preventDefault();
        setError("");
        try {
            const r = await api("/leveling/xp", { method: "POST", channel, body: grantXp, toast: false });
            toast(`XP aktualisiert: ${grantXp.username} hat jetzt ${r.xp} XP (Level ${r.level})`);
            setGrantXp({ ...grantXp, username: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>Level & Punkte</h2>
            <MobileHint>
                <p className="hint">
                    Zwei getrennte Systeme: XP bestimmt nur das Level (Chatnachrichten + Watchtime), Punkte sind die separate,
                    ausgebbare Währung (ebenfalls über Watchtime verdient, z. B. als Einsatz für Giveaways nutzbar). Level-Up wird
                    im Chat gemeldet – Text und Ein/Aus dafür unter Chat → Alerts → "Level-Up".
                </p>
            </MobileHint>
            {error && <p className="error">{error}</p>}
            {settings && (
                <Collapsible title="Einstellungen">
                    <div className="panel settings-panel">
                        <div className="setting-group">
                            <StatusToggle label="Level-/XP-System" field={settings.levelingEnabled}
                                onChange={(v) => patchSettings({ levelingEnabled: v })} />
                            <div className={"setting-sub" + (settings.levelingEnabled.value ? "" : " off")}>
                                <NumberSetting label="XP für Level 1" field={settings.levelXpBase}
                                    onChange={(v) => patchSettings({ levelXpBase: v })} onReset={() => patchSettings({ levelXpBase: null })} />
                                <DecimalSetting label="Faktor pro Level (jedes Level kostet so viel mal mehr als das vorherige)" field={settings.levelXpMultiplier}
                                    onChange={(v) => patchSettings({ levelXpMultiplier: v })} onReset={() => patchSettings({ levelXpMultiplier: null })} />
                                <p className="hint">
                                    Gesamt-XP bis Level:{" "}
                                    {[1, 2, 5, 10, 20].map((n) => {
                                        const m = settings.levelXpMultiplier.value, b = settings.levelXpBase.value;
                                        const xp = Math.round(m === 1 ? b * n : (b * (Math.pow(m, n) - 1)) / (m - 1));
                                        return `${n}: ${xp.toLocaleString("de-DE")}`;
                                    }).join(" · ")}
                                </p>
                                <NumberSetting label="XP pro Chatnachricht" field={settings.xpPerMessage}
                                    onChange={(v) => patchSettings({ xpPerMessage: v })} onReset={() => patchSettings({ xpPerMessage: null })} />
                                <NumberSetting label="Cooldown für Nachrichten-XP (Sekunden)" field={settings.messageXpCooldownSeconds}
                                    onChange={(v) => patchSettings({ messageXpCooldownSeconds: v })} onReset={() => patchSettings({ messageXpCooldownSeconds: null })} />
                                <NumberSetting label="XP pro Minute Watchtime" field={settings.xpPerWatchMinute}
                                    onChange={(v) => patchSettings({ xpPerWatchMinute: v })} onReset={() => patchSettings({ xpPerWatchMinute: null })} />
                            </div>
                        </div>
                        <div className="setting-group">
                            <StatusToggle label="Punkte-System" field={settings.pointsEnabled}
                                onChange={(v) => patchSettings({ pointsEnabled: v })} />
                            <div className={"setting-sub" + (settings.pointsEnabled.value ? "" : " off")}>
                                <NumberSetting label="Punkte pro Chatnachricht" field={settings.pointsPerMessage}
                                    onChange={(v) => patchSettings({ pointsPerMessage: v })} onReset={() => patchSettings({ pointsPerMessage: null })} />
                                <NumberSetting label="Cooldown für Nachrichten-Punkte (Sekunden)" field={settings.messagePointsCooldownSeconds}
                                    onChange={(v) => patchSettings({ messagePointsCooldownSeconds: v })} onReset={() => patchSettings({ messagePointsCooldownSeconds: null })} />
                                <NumberSetting label="Punkte pro Minute Watchtime" field={settings.pointsPerWatchMinute}
                                    onChange={(v) => patchSettings({ pointsPerWatchMinute: v })} onReset={() => patchSettings({ pointsPerWatchMinute: null })} />
                            </div>
                        </div>
                    </div>
                </Collapsible>
            )}
            <div className="row" style={{ marginTop: "1em" }}>
                <div className="panel" style={{ flex: 1 }}>
                    <div className="heading-row">
                        <h3>Top 10 – Level/XP</h3>
                        {isAdmin && <button type="button" className="danger" onClick={resetLevels} title="Setzt XP und Level aller Nutzer auf 0 (Punkte bleiben); Nutzer ohne XP und Punkte werden aus der Tabelle gelöscht">Zurücksetzen</button>}
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Nutzer</th><th>Level</th><th>XP</th></tr></thead>
                        <tbody>
                            {(top.xp ?? []).map((r, i) => (
                                <tr key={r.username}><td>{i + 1}</td><td>{r.displayName || r.username}</td><td>{r.level}</td><td>{r.xp}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="panel" style={{ flex: 1 }}>
                    <div className="heading-row">
                        <h3>Top 10 – Punkte</h3>
                        {isAdmin && <button type="button" className="danger" onClick={resetAllPoints} title="Setzt die Punkte aller Nutzer auf 0 (XP und Level bleiben); Nutzer ohne XP und Punkte werden aus der Tabelle gelöscht">Zurücksetzen</button>}
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Nutzer</th><th>Punkte</th></tr></thead>
                        <tbody>
                            {(top.points ?? []).map((r, i) => (
                                <tr key={r.username}><td>{i + 1}</td><td>{r.displayName || r.username}</td><td>{r.points}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {isAdmin && (<>
            <div className="panel">
                <h3>Punkte vergeben/entziehen</h3>
                <form className="row" onSubmit={givePoints}>
                    <input placeholder="Nutzername" value={grant.username} onChange={(e) => setGrant({ ...grant, username: e.target.value })} required />
                    <input type="number" title="Anzahl (negativ = entziehen)" value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: Number(e.target.value) })} />
                    <button type="submit">Vergeben</button>
                </form>
            </div>
            <div className="panel">
                <h3>XP vergeben/entziehen</h3>
                <p className="hint">Ändert XP und damit das Level (negativer Wert = entziehen, nie unter 0). Es kommt keine Level-Up-Meldung im Chat.</p>
                <form className="row" onSubmit={giveXp}>
                    <input placeholder="Nutzername" value={grantXp.username} onChange={(e) => setGrantXp({ ...grantXp, username: e.target.value })} required />
                    <input type="number" title="Anzahl XP (negativ = entziehen)" value={grantXp.amount} onChange={(e) => setGrantXp({ ...grantXp, amount: Number(e.target.value) })} />
                    <button type="submit">Vergeben</button>
                </form>
            </div>
            </>)}
        </section>
    );
}

/** Unterpunkt "Watchtime": Übersicht, wie lange jeder Nutzer diesen Kanal schon schaut (Gesamt oder diesen Monat). */
export function WatchtimeOverview({ channel }) {
    const LIMIT = 20;
    const [month, setMonth] = useState("alltime"); // "alltime" | "month" | "range"
    const nowMonth = new Date().toISOString().slice(0, 7);
    const [rangeFrom, setRangeFrom] = useState(nowMonth);
    const [rangeTo, setRangeTo] = useState(nowMonth);
    const rangeInvalid = month === "range" && (!rangeFrom || !rangeTo || rangeFrom > rangeTo);
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ rows: [] });
    const [error, setError] = useState("");
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    const [excludedText, setExcludedText] = useState("");
    const [editingExcluded, setEditingExcluded] = useState(false); // Liste ist gesperrt, bis man auf "Bearbeiten" klickt
    const excludedKey = settings ? settings.watchtimeExcluded.value.join("\n") : null;
    useEffect(() => { if (excludedKey !== null && !editingExcluded) setExcludedText(excludedKey); }, [excludedKey, editingExcluded]);
    const isAdmin = getIsAdmin();
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [editing, setEditing] = useState(null); // { viewer, hours, minutes }
    const editRef = useRef(null);
    useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);
    useEffect(() => { setPage(1); }, [debounced]);
    useEffect(() => { if (editing) editRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [editing?.viewer]);

    const load = useCallback(() => {
        if (rangeInvalid) return;
        const range = month === "range" ? `&from=${rangeFrom}&to=${rangeTo}` : "";
        setError("");
        api(`/watchtime-list?page=${page}&month=${month}${range}&q=${encodeURIComponent(debounced)}`, { channel }).then(setData).catch((e) => setError(e.message));
    }, [channel, page, month, rangeFrom, rangeTo, rangeInvalid, debounced]);
    useEffect(load, [load]);

    function startEdit(r) {
        const minutes = Math.round(r.watchtime / 2);
        setEditing({ viewer: r.viewer, hours: Math.floor(minutes / 60), minutes: minutes % 60 });
    }

    async function saveWatchtime(e) {
        e.preventDefault();
        setError("");
        const total = Math.max(0, Number(editing.hours) || 0) * 60 + Math.max(0, Number(editing.minutes) || 0);
        try {
            await api(`/watchtime/${encodeURIComponent(editing.viewer)}`, { method: "PUT", channel, body: { month, minutes: total }, toast: "Watchtime gespeichert" });
            setEditing(null);
            load();
        } catch (err) {
            setError(err.message);
        }
    }

    async function saveExcluded() {
        await patchSettings({ watchtimeExcluded: excludedText.split("\n").map((l) => l.trim()).filter(Boolean) });
        setEditingExcluded(false);
    }

    function fmt(units) {
        const minutes = units * 0.5;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return h > 0 ? `${h} h ${m} min` : `${m} min`;
    }

    return (
        <section>
            <h2>Watchtime – Übersicht</h2>
            {settings && (
                <Collapsible title="Einstellungen">
                    <div className="panel settings-panel">
                        <div className="setting-group">
                            <StatusToggle label="Watchtime-Erfassung" field={settings.watchtimeEnabled}
                                onChange={(v) => patchSettings({ watchtimeEnabled: v })} />
                        </div>
                        <div className="setting-group setting-list">
                            <span>Nutzer ohne Watchtime</span>
                            <p className="hint">
                                Diese Twitch-Namen (einer pro Zeile) sammeln keine Watchtime und damit auch keine Watch-XP und -Punkte, z. B. andere Bots
                                oder du selbst. Bereits gesammelte Watchtime bleibt erhalten.
                            </p>
                            <textarea rows={4} value={excludedText} readOnly={!editingExcluded} onChange={(e) => setExcludedText(e.target.value)}
                                placeholder={editingExcluded ? "z. B. nightbot" : "Noch niemand eingetragen"} style={editingExcluded ? undefined : { opacity: 0.7, cursor: "default" }} />
                            <div className="row">
                                {editingExcluded ? (
                                    <>
                                        <button type="button" onClick={saveExcluded}>Speichern</button>
                                        <button type="button" onClick={() => { setExcludedText(excludedKey ?? ""); setEditingExcluded(false); }}>Abbrechen</button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => setEditingExcluded(true)}>Bearbeiten</button>
                                )}
                            </div>
                        </div>
                    </div>
                </Collapsible>
            )}
            <div className="row">
                <select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }}>
                    <option value="alltime">Gesamt</option>
                    <option value="month">Dieser Monat</option>
                    <option value="range">Zeitspanne (Monate)</option>
                </select>
                {month === "range" && (
                    <>
                        <label className="setting">Von
                            <input type="month" value={rangeFrom} max={rangeTo || undefined} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
                        </label>
                        <label className="setting">Bis
                            <input type="month" value={rangeTo} min={rangeFrom || undefined} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
                        </label>
                    </>
                )}
            </div>
            {month === "range" && <p className="hint">Zeigt die Summe der Monatswerte von „Von" bis „Bis" (einschließlich). Genauer als auf Monate geht es nicht, weil die Watchtime nur pro Monat gespeichert wird. In dieser Ansicht lässt sich die Watchtime nicht bearbeiten.</p>}
            {rangeInvalid && <p className="error">„Von" muss vor oder gleich „Bis" liegen.</p>}
            <div className="row">
                <input type="search" placeholder="Nutzer suchen ..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {error && <p className="error">{error}</p>}
            {editing && (
                <form className="panel" onSubmit={saveWatchtime} ref={editRef}>
                    <h3>Watchtime bearbeiten: {editing.viewer} ({month === "alltime" ? "Gesamt" : "Dieser Monat"})</h3>
                    <div className="row">
                        <label className="setting">Stunden
                            <input type="number" min="0" value={editing.hours} onChange={(e) => setEditing({ ...editing, hours: e.target.value })} />
                        </label>
                        <label className="setting">Minuten
                            <input type="number" min="0" value={editing.minutes} onChange={(e) => setEditing({ ...editing, minutes: e.target.value })} />
                        </label>
                        <button type="submit">Speichern</button>
                        <button type="button" onClick={() => setEditing(null)}>Abbrechen</button>
                    </div>
                    <p className="hint">Setzt die Watchtime auf genau diesen Wert (nur für die gewählte Ansicht oben: Gesamt bzw. dieser Monat).</p>
                </form>
            )}
            <table>
                <thead><tr><th>#</th><th>Nutzer</th><th>Watchtime</th>{isAdmin && month !== "range" && <th></th>}</tr></thead>
                <tbody>
                    {(data.rows ?? []).map((r, i) => (
                        <tr key={r.viewer}>
                            <td>{(page - 1) * LIMIT + i + 1}</td><td>{r.viewer}</td><td>{fmt(r.watchtime)}</td>
                            {isAdmin && month !== "range" && <td className="actions"><button onClick={() => startEdit(r)}>Bearbeiten</button></td>}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="row">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Zurück</button>
                <span>Seite {page}</span>
                <button disabled={(data.rows ?? []).length < LIMIT} onClick={() => setPage((p) => p + 1)}>Weiter</button>
            </div>
        </section>
    );
}
