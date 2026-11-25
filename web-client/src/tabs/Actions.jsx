import { useState } from "react";
import { api } from "../api";
import { useChannelSettings, NumberSetting, Collapsible, useList, useIsMobile, MobileHint, StatusToggle } from "../components/common.jsx";

export function Giveaway({ channel, meta }) {
    const [sub, setSub] = useState("Basic");
    const SUBS = ["Basic", "Settings", "Verlauf"];
    return (
        <div>
            <div className="subnav">
                {SUBS.map((s) => (
                    <button key={s} className={s === sub ? "active" : ""} onClick={() => setSub(s)}>{s}</button>
                ))}
            </div>
            {sub === "Basic" && <GiveawayBasic channel={channel} meta={meta} />}
            {sub === "Settings" && <GiveawaySettings channel={channel} />}
            {sub === "Verlauf" && <GiveawayHistory channel={channel} />}
        </div>
    );
}

/** Unterpunkt "Verlauf" im Giveaway-Bereich: die letzten 10 abgeschlossenen Giveaways. */
export function GiveawayHistory({ channel }) {
    const { rows, error } = useList("/giveaways-history", channel);
    return (
        <section>
            <h2>Giveaway – Verlauf</h2>
            <p className="hint">Die letzten 10 abgeschlossenen Giveaways.</p>
            {error && <p className="error">{error}</p>}
            <table>
                <thead><tr><th>Name</th><th>Gewinner</th><th>Teilnehmer</th></tr></thead>
                <tbody>
                    {(rows ?? []).map((g) => (
                        <tr key={g.id}>
                            <td>{g.title}</td>
                            <td>{g.winners?.length ? g.winners.join(", ") : "–"}</td>
                            <td>{g.entry_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!rows?.length && <p className="hint">Noch keine abgeschlossenen Giveaways.</p>}
        </section>
    );
}

export function GiveawayBasic({ channel, meta }) {
    const { rows, reload, error, setError } = useList("/giveaways", channel);
    const [form, setForm] = useState({ title: "", keyword: "", permission: "everyone", winnerCount: 1, autoDraw: false, durationSeconds: 300, pointCost: 0 });
    const [details, setDetails] = useState(null);

    async function start(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/giveaways", { method: "POST", channel, body: {
                title: form.title, keyword: form.keyword, minPermission: meta.permissions ? Object.entries(meta.permissions).find(([, v]) => v === form.permission)?.[0] : 0,
                winnerCount: form.winnerCount, autoDraw: form.autoDraw, durationSeconds: form.durationSeconds, pointCost: form.pointCost,
            } });
            setForm({ ...form, title: "", keyword: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    const act = (fn) => async (id) => { try { await fn(id); reload(); } catch (err) { setError(err.message); } };
    const stop = act((id) => api(`/giveaways/${id}/stop`, { method: "POST", channel }));
    const draw = act((id) => api(`/giveaways/${id}/draw`, { method: "POST", channel }));
    const remove = act((id) => api(`/giveaways/${id}`, { method: "DELETE", channel }));

    async function open(id) {
        const g = await api(`/giveaways/${id}`, { channel });
        setDetails(g);
    }

    return (
        <section>
            <h2>Giveaway</h2>
            <form className="row" onSubmit={start}>
                <input placeholder="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <input placeholder="Stichwort im Chat" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} required />
                <input type="number" min="1" title="Anzahl Gewinner" value={form.winnerCount} onChange={(e) => setForm({ ...form, winnerCount: Number(e.target.value) })} />
                <label><input type="checkbox" checked={form.autoDraw} onChange={(e) => setForm({ ...form, autoDraw: e.target.checked })} /> Auto-Ziehung nach</label>
                {form.autoDraw && <input type="number" min="10" title="Sekunden" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} />}
                <div className="row-break" />
                <label title="0 = kostenlos, wie bisher">Punkte-Einsatz zum Teilnehmen
                    <input type="number" min="0" value={form.pointCost} onChange={(e) => setForm({ ...form, pointCost: Number(e.target.value) })} />
                </label>
                <button type="submit">Starten</button>
            </form>
            <p className="hint">Teilnahme: Zuschauer schreiben das Stichwort als Chatnachricht. Bei Punkte-Einsatz &gt; 0 werden die Punkte beim Teilnehmen automatisch abgezogen (0 = kostenlos, wie bisher).</p>
            {error && <p className="error">{error}</p>}
            <table>
                <thead><tr><th>Titel</th><th>Stichwort</th><th>Einsatz</th><th>Status</th><th>Gewinner</th><th></th></tr></thead>
                <tbody>
                    {rows.map((g) => (
                        <tr key={g.id}>
                            <td><button className="link" onClick={() => open(g.id)}>{g.title}</button></td>
                            <td>{g.keyword}</td>
                            <td>{g.point_cost > 0 ? `${g.point_cost} Punkte` : "kostenlos"}</td>
                            <td>{g.status}</td>
                            <td>{g.winners?.join(", ")}</td>
                            <td className="actions">
                                {g.status === "open" && <button onClick={() => stop(g.id)}>Schließen</button>}
                                {g.status !== "drawn" && <button onClick={() => draw(g.id)}>Ziehen</button>}
                                <button className="danger" onClick={() => remove(g.id)}>Löschen</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {details && (
                <div className="panel">
                    <h3>{details.title} – Teilnehmer ({details.entries.length})</h3>
                    <p>{details.entries.map((e) => e.display_name || e.username).join(", ") || "Noch keine Teilnehmer."}</p>
                    <button onClick={() => setDetails(null)}>Schließen</button>
                </div>
            )}
        </section>
    );
}

/** Unterpunkt "Settings" im Giveaway-Bereich: Texte für Start/Erinnerung/Teilnahme/Ende/Ziehung + Erinnerungs-Intervall. */
export function GiveawaySettings({ channel }) {
    const { rows, reload, error, setError } = useList("/giveaway-templates", channel);
    const [drafts, setDrafts] = useState({});
    const { settings, patch: patchSettings } = useChannelSettings(channel);

    const draftFor = (a) => drafts[a.type] ?? a.template;

    async function save(a) {
        setError("");
        try {
            await api(`/giveaway-templates/${a.type}`, { method: "PUT", channel, body: { template: draftFor(a) } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function reset(a) {
        try {
            await api(`/giveaway-templates/${a.type}`, { method: "DELETE", channel });
            setDrafts((d) => { const next = { ...d }; delete next[a.type]; return next; });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function test(a) {
        try {
            await api(`/giveaway-templates/${a.type}/test`, { method: "POST", channel, body: { template: draftFor(a) } });
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>Giveaway – Settings</h2>
            <p className="hint">Texte für die einzelnen Giveaway-Phasen. Platzhalter in geschweiften Klammern werden beim Senden ersetzt.</p>
            {error && <p className="error">{error}</p>}
            {settings && (
                <div className="panel settings-panel">
                    <NumberSetting label="Erinnerung alle (Minuten, 0 = aus)" field={settings.giveawayRepeatMinutes}
                        onChange={(v) => patchSettings({ giveawayRepeatMinutes: v })} onReset={() => patchSettings({ giveawayRepeatMinutes: null })} />
                </div>
            )}
            {rows.map((a) => (
                <div className="panel" key={a.type}>
                    <h3>{a.label}{a.isCustom && <span className="hint"> (angepasst)</span>}</h3>
                    <p className="hint">Platzhalter: {a.placeholders.map((p) => `{${p}}`).join(", ")}</p>
                    <textarea
                        rows={2}
                        value={draftFor(a)}
                        onChange={(e) => setDrafts((d) => ({ ...d, [a.type]: e.target.value }))}
                    />
                    <div className="row">
                        <button onClick={() => save(a)}>Speichern</button>
                        <button onClick={() => test(a)}>Testen (im Chat senden)</button>
                        {a.isCustom && <button className="danger" onClick={() => reset(a)}>Auf Standard zurücksetzen</button>}
                    </div>
                </div>
            ))}
        </section>
    );
}

export function Poll({ channel }) {
    const { rows, reload, error, setError } = useList("/polls", channel);
    const [form, setForm] = useState({ title: "", options: "", mode: "chat", durationSeconds: 60 });
    const isMobile = useIsMobile();
    const [openId, setOpenId] = useState(null); // Handy: aufgeklappte Umfrage

    async function start(e) {
        e.preventDefault();
        setError("");
        try {
            const options = form.options.split(",").map((s) => s.trim()).filter(Boolean);
            await api("/polls", { method: "POST", channel, body: { title: form.title, options, mode: form.mode, durationSeconds: form.durationSeconds } });
            setForm({ ...form, title: "", options: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    const end = async (id) => { try { await api(`/polls/${id}/end`, { method: "POST", channel }); reload(); } catch (err) { setError(err.message); } };
    const remove = async (id) => { try { await api(`/polls/${id}`, { method: "DELETE", channel }); reload(); } catch (err) { setError(err.message); } };

    return (
        <section>
            <h2>Umfrage</h2>
            <form className="row" onSubmit={start}>
                <input placeholder="Frage" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <input className="grow" placeholder="Antworten, mit Komma getrennt" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} required />
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                    <option value="chat">Abstimmung per Chat (Zahl)</option>
                    <option value="twitch">Twitch-Poll</option>
                </select>
                <input type="number" min="15" title="Dauer in Sekunden" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} />
                <button type="submit">Starten</button>
            </form>
            {error && <p className="error">{error}</p>}
            {isMobile ? (
                <div className="cmd-list">
                    {rows.map((p) => {
                        const open = openId === p.id;
                        const result = p.result ? p.options.map((o, i) => `${o}: ${p.result[i]}`).join(", ") : "-";
                        return (
                            <div key={p.id} className={"cmd-card" + (open ? " open" : "")}>
                                <div className="cmd-card-head" onClick={() => setOpenId(open ? null : p.id)}>
                                    <span className={"collapsible-arrow" + (open ? " open" : "")}>▶</span>
                                    <strong>{p.title}</strong>
                                    <span className="cmd-meta">{p.status}</span>
                                </div>
                                {open && (
                                    <>
                                        <p className="cmd-response">Modus: {p.mode}<br />Ergebnis: {result}</p>
                                        <div className="cmd-actions">
                                            {p.status === "active" && <button onClick={() => end(p.id)}>Beenden</button>}
                                            <button className="danger" onClick={() => remove(p.id)}>Löschen</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <table>
                    <thead><tr><th>Frage</th><th>Modus</th><th>Status</th><th>Ergebnis</th><th></th></tr></thead>
                    <tbody>
                        {rows.map((p) => (
                            <tr key={p.id}>
                                <td>{p.title}</td>
                                <td>{p.mode}</td>
                                <td>{p.status}</td>
                                <td>{p.result ? p.options.map((o, i) => `${o}: ${p.result[i]}`).join(", ") : "-"}</td>
                                <td className="actions">
                                    {p.status === "active" && <button onClick={() => end(p.id)}>Beenden</button>}
                                    <button className="danger" onClick={() => remove(p.id)}>Löschen</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export function ActionsSection({ channel, meta }) {
    const [sub, setSub] = useState("Giveaway");
    const SUBS = ["Giveaway", "Umfrage", "Wette", "Rewards"];
    return (
        <div>
            <div className="subnav">
                {SUBS.map((s) => (
                    <button key={s} className={s === sub ? "active" : ""} onClick={() => setSub(s)}>{s}</button>
                ))}
            </div>
            {sub === "Giveaway" && <Giveaway channel={channel} meta={meta} />}
            {sub === "Umfrage" && <Poll channel={channel} />}
            {sub === "Wette" && <Prediction channel={channel} />}
            {sub === "Rewards" && <ChannelRewards channel={channel} />}
        </div>
    );
}

export function ChannelRewards({ channel }) {
    const { rows, reload, error, setError } = useList("/channel-rewards", channel);
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    const enabled = settings ? settings.rewardsEnabled.value : true;
    const redemptions = useList("/channel-rewards/redemptions", channel);
    const [form, setForm] = useState({ title: "", cost: 100, prompt: "", userInputRequired: false });

    async function create(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/channel-rewards", { method: "POST", channel, body: form });
            setForm({ title: "", cost: 100, prompt: "", userInputRequired: false });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(id) {
        try {
            await api(`/channel-rewards/${id}`, { method: "DELETE", channel });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>Punkte-Rewards</h2>
            {settings && (
                <Collapsible title="Reward-Einstellungen">
                    <div className="panel settings-panel">
                        <StatusToggle label="Reward-System" field={settings.rewardsEnabled}
                            onChange={(v) => patchSettings({ rewardsEnabled: v })} />
                        {!enabled && (
                            <p className="hint warn">
                                Das Reward-System ist für diesen Kanal ausgeschaltet: Einlösungen werden nicht mehr protokolliert, und neue Rewards lassen sich nicht anlegen.
                                Bereits bei Twitch angelegte Rewards bleiben unverändert bestehen.
                            </p>
                        )}
                    </div>
                </Collapsible>
            )}
            <MobileHint>
                <p className="hint">
                    Einlösungen werden in Echtzeit für ALLE Rewards dieses Kanals protokolliert - auch manuell im
                    Twitch-Dashboard angelegte, nicht nur über das Formular hier angelegte. Nur für selbst angelegte Rewards kann
                    der Bot die Einlösung bei Twitch danach auch automatisch als erledigt markieren (Twitch-Einschränkung, siehe
                    Spalte "Erledigt"). Zum Anlegen eigener Rewards braucht der hinterlegte API-Token den Scope{" "}
                    <code>channel:manage:redemptions</code>, fürs Erfassen der Einlösungen zusätzlich <code>channel:read:redemptions</code>.
                </p>
            </MobileHint>
            <form className="row" onSubmit={create}>
              <fieldset disabled={!enabled} className="plain-fieldset">
                <input placeholder="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <input type="number" min="1" title="Kosten in Channel Points" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} required />
                <input className="grow" placeholder="Prompt-Text (optional)" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
                <label className="row" style={{ alignItems: "center" }}>
                    <input type="checkbox" checked={form.userInputRequired} onChange={(e) => setForm({ ...form, userInputRequired: e.target.checked })} />
                    Text-Eingabe erforderlich
                </label>
                <button type="submit">Anlegen</button>
              </fieldset>
            </form>
            {error && <p className="error">{error}</p>}
            <table>
                <thead><tr><th>Titel</th><th>Kosten</th><th>Prompt</th><th>Text-Eingabe</th><th></th></tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id}>
                            <td>{r.title}</td>
                            <td>{r.cost}</td>
                            <td>{r.prompt || "-"}</td>
                            <td>{r.user_input_required ? "Ja" : "Nein"}</td>
                            <td className="actions">
                                <button className="danger" onClick={() => remove(r.id)}>Löschen</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h3>Einlösungen</h3>
            {redemptions.error && <p className="error">{redemptions.error}</p>}
            <table>
                <thead><tr><th>Zeitpunkt</th><th>Nutzer</th><th>Reward</th><th>Kosten</th><th>Eingabe</th><th>Erledigt</th></tr></thead>
                <tbody>
                    {redemptions.rows.map((r) => (
                        <tr key={r.id}>
                            <td>{new Date(r.redeemed_at).toLocaleString("de-DE")}</td>
                            <td>{r.user_name}</td>
                            <td>{r.reward_title}</td>
                            <td>{r.reward_cost}</td>
                            <td>{r.user_input || "-"}</td>
                            <td>{r.fulfilled ? "Ja" : "Nein (nicht vom Bot angelegt?)"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export function Prediction({ channel }) {
    const { rows, reload, error, setError } = useList("/predictions", channel);
    const [form, setForm] = useState({ title: "", outcomes: "", durationSeconds: 60 });
    const [resolving, setResolving] = useState(null);

    async function start(e) {
        e.preventDefault();
        setError("");
        try {
            const outcomes = form.outcomes.split(",").map((s) => s.trim()).filter(Boolean);
            await api("/predictions", { method: "POST", channel, body: { title: form.title, outcomes, durationSeconds: form.durationSeconds } });
            setForm({ ...form, title: "", outcomes: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    const act = (fn) => async (id) => {
        try {
            await fn(id);
            reload();
        } catch (err) {
            setError(err.message);
        }
    };
    const lock = act((id) => api(`/predictions/${id}/lock`, { method: "POST", channel }));
    const cancel = act((id) => api(`/predictions/${id}/cancel`, { method: "POST", channel }));
    const remove = act((id) => api(`/predictions/${id}`, { method: "DELETE", channel }));

    async function resolve(id, winningIndex) {
        setError("");
        try {
            await api(`/predictions/${id}/resolve`, { method: "POST", channel, body: { winningIndex } });
            setResolving(null);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    const resolvingPrediction = rows.find((p) => p.id === resolving);

    return (
        <section>
            <h2>Wette</h2>
            <MobileHint>
                <p className="hint">
                    Nutzt Twitchs eigenes Prediction-Feature mit Channel Points: Zuschauer setzen direkt auf der Twitch-Kanalseite,
                    nicht im Chat. Dafür braucht der hinterlegte API-Token die Scopes <code>channel:manage:predictions</code> (+{" "}
                    <code>channel:read:predictions</code>).
                </p>
            </MobileHint>
            <form className="row" onSubmit={start}>
                <input placeholder="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <input className="grow" placeholder="Ergebnisse, mit Komma getrennt (2-10)" value={form.outcomes} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} required />
                <input type="number" min="30" max="1800" title="Dauer in Sekunden" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} />
                <button type="submit">Starten</button>
            </form>
            {error && <p className="error">{error}</p>}
            <table>
                <thead><tr><th>Titel</th><th>Ergebnisse</th><th>Status</th><th>Gewinner</th><th></th></tr></thead>
                <tbody>
                    {rows.map((p) => (
                        <tr key={p.id}>
                            <td>{p.title}</td>
                            <td>{p.outcomes.map((o) => o.title).join(", ")}</td>
                            <td>{p.status}</td>
                            <td>{p.winning_outcome != null ? p.outcomes[p.winning_outcome]?.title ?? "-" : "-"}</td>
                            <td className="actions">
                                {p.status === "active" && <button onClick={() => lock(p.id)}>Sperren</button>}
                                {(p.status === "active" || p.status === "locked") && <button onClick={() => setResolving(p.id)}>Auswerten</button>}
                                {(p.status === "active" || p.status === "locked") && <button onClick={() => cancel(p.id)}>Abbrechen</button>}
                                {(p.status === "resolved" || p.status === "canceled") && <button className="danger" onClick={() => remove(p.id)}>Löschen</button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {resolvingPrediction && (
                <div className="panel">
                    <h3>"{resolvingPrediction.title}" – Gewinner-Ergebnis wählen</h3>
                    <div className="row">
                        {resolvingPrediction.outcomes.map((o, i) => (
                            <button key={i} onClick={() => resolve(resolving, i)}>{o.title}</button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setResolving(null)}>Abbrechen</button>
                </div>
            )}
        </section>
    );
}
