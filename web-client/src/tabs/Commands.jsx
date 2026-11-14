import { useEffect, useState } from "react";
import { api } from "../api";
import { useChannelSettings, StatusToggle, NumberSetting, BoolSetting, Collapsible, useList, FilterBar, matchesQuery, useIsMobile, CardList, MobileHint } from "../components/common.jsx";

/** Reiter "Commands" mit Unterpunkten Command / Alias / Counter. */
export function CommandsSection({ channel, meta }) {
    const [sub, setSub] = useState("Command");
    const SUBS = ["Command", "Counter", "Timer", "Botcommands"];
    return (
        <div>
            <div className="subnav">
                {SUBS.map((s) => (
                    <button key={s} className={s === sub ? "active" : ""} onClick={() => setSub(s)}>{s}</button>
                ))}
            </div>
            {sub === "Command" && <CommandSubsection channel={channel} meta={meta} />}
            {sub === "Counter" && <Counters channel={channel} />}
            {sub === "Timer" && <Timers channel={channel} />}
            {sub === "Botcommands" && <BotCommandsHelp channel={channel} />}
        </div>
    );
}

export function BotCommandsHelp({ channel }) {
    const { rows, error } = useList("/commands/builtin", channel);

    // Normale Mod-Commands (eigene Rechtestufe) werden als eine Zeile gezeigt. Commands, die für alle
    // sind, aber einzelne Unterbefehle mit eigener Rechtestufe haben (z. B. !zitat add/remove/<ID>),
    // bekommen stattdessen pro Unterbefehl eine eigene Zeile (modRows).
    const displayRows = rows.flatMap((r) => {
        if (r.modRows?.length) {
            return r.modRows.map((m, i) => ({
                key: `${r.command}-${i}`,
                name: `!${r.command}`,
                extra: m.usage,
                permission: m.perm ?? "moderator",
                desc: m.desc,
            }));
        }
        if (r.permission === "everyone") return [];
        return [{
            key: r.command,
            name: `!${r.command}`,
            aliases: r.aliases.map((a) => `!${a}`).join(", "),
            permission: r.permission,
            desc: r.desc,
        }];
    });

    return (
        <section>
            <h2>Botcommands</h2>
            <p className="hint">Diese Commands (bzw. Unterbefehle) können nur von Moderatoren (bzw. dem Streamer) im Twitch-Chat genutzt werden.</p>
            {error && <p className="error">{error}</p>}
            <table className="botcommands-table">
                <thead><tr><th>Command</th><th>Rechte</th><th>Beschreibung</th></tr></thead>
                <tbody>
                    {displayRows.map((r) => (
                        <tr key={r.key}>
                            <td>
                                <span className="bc-name">{r.name}</span>{r.extra ? ` ${r.extra}` : ""}
                                {r.aliases && <div className="hint">({r.aliases})</div>}
                            </td>
                            <td>{r.permission}</td>
                            <td>{r.desc || "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export function CommandSubsection({ channel, meta }) {
    const [sub, setSub] = useState("Custom Befehle");
    const SUBS = ["Standard Befehle", "Custom Befehle"];
    return (
        <div>
            <div className="subnav subnav-inner">
                {SUBS.map((s) => (
                    <button key={s} className={s === sub ? "active" : ""} onClick={() => setSub(s)}>{s}</button>
                ))}
            </div>
            {sub === "Standard Befehle" && <BuiltinCommands channel={channel} />}
            {sub === "Custom Befehle" && <Commands channel={channel} meta={meta} />}
        </div>
    );
}

export function BuiltinCommands({ channel }) {
    return (
        <BuiltinCommandsTable
            channel={channel}
            // !raid steht zwar nicht jedem offen (Rechtestufe VIP), wird aber trotzdem hier mitgelistet,
            // damit er nicht nur unter "Botcommands" auftaucht - die Spalte "Rechte" zeigt seine echte Stufe.
            filter={(r) => r.permission === "everyone" || r.command === "raid"}
            title="Standard Befehle"
            hint='Fest einprogrammierte Commands des Bots – Name, Aliase und Rechte können hier nicht geändert werden, nur an-/ausgeschaltet. Mod-Commands stehen unter "Botcommands", eigene Commands unter "Custom Befehle".'
        />
    );
}

export function BuiltinCommandsTable({ channel, filter, title, hint }) {
    const { rows, reload, error, setError } = useList("/commands/builtin", channel);
    const [query, setQuery] = useState("");
    const isMobile = useIsMobile();
    const base = rows.filter(filter);
    const filtered = base.filter((r) => matchesQuery(query, r.command, r.aliases.join(" ")));

    async function toggle(name, enabled) {
        try {
            await api(`/commands/builtin/${name}/enabled`, { method: "PUT", channel, body: { enabled } });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>{title}</h2>
            <p className="hint">{hint}</p>
            {error && <p className="error">{error}</p>}
            <FilterBar query={query} setQuery={setQuery} shown={filtered.length} total={base.length} active={!!query}
                onClear={() => setQuery("")} placeholder="Command oder Alias suchen ..." />
            {isMobile ? (
                <CardList rows={filtered} rowKey={(r) => r.command}
                    title={(r) => `!${r.command}`}
                    meta={(r) => (r.locked ? "immer an" : r.enabled ? "an" : "aus")}
                    preview={(r) => (r.aliases.length ? r.aliases.map((a) => `!${a}`).join(", ") : "Keine Aliase")}
                    details={(r) => <div><span className="hint">Rechte: </span>{r.permission}</div>}
                    actions={(r) => (r.locked
                        ? <span className="hint">immer an</span>
                        : <button onClick={() => toggle(r.command, !r.enabled)}>{r.enabled ? "Ausschalten" : "Einschalten"}</button>)} />
            ) : (
                <table>
                    <thead><tr><th>Command</th><th>Aliase</th><th>Rechte</th><th>Aktiv</th><th></th></tr></thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={r.command}>
                                <td>!{r.command}</td>
                                <td>{r.aliases.length ? r.aliases.map((a) => `!${a}`).join(", ") : "-"}</td>
                                <td>{r.permission}</td>
                                <td>{r.enabled ? "an" : "aus"}</td>
                                <td className="actions">
                                    {r.locked ? <span className="hint">immer an</span> : <button onClick={() => toggle(r.command, !r.enabled)}>{r.enabled ? "Ausschalten" : "Einschalten"}</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

function CommandEditor({ r, meta, channel, reload, aliases = [], reloadAliases }) {
    const [draft, setDraft] = useState({ command: r.command, response: r.response, permission: meta.permissions[r.permission], cooldown: r.cooldown });
    const [err, setErr] = useState("");
    const [saved, setSaved] = useState(false);
    const [newAlias, setNewAlias] = useState("");
    const [aliasErr, setAliasErr] = useState("");

    async function addAlias(e) {
        e.preventDefault();
        setAliasErr("");
        try {
            await api("/aliases", { method: "POST", channel, body: { alias: newAlias, command: r.command } });
            setNewAlias("");
            reloadAliases();
        } catch (err) {
            setAliasErr(err.message);
        }
    }

    async function removeAlias(a) {
        if (!confirm(`Alias ${meta.prefix}${a} wirklich löschen?`)) return;
        setAliasErr("");
        try {
            await api(`/aliases/${a}`, { method: "DELETE", channel });
            reloadAliases();
        } catch (err) {
            setAliasErr(err.message);
        }
    }

    async function save() {
        setErr(""); setSaved(false);
        try {
            const newName = draft.command.trim().replace(/^!+/, "").toLowerCase();
            let name = r.command;
            if (newName && newName !== r.command) {
                // erst umbenennen (Aliase gehen mit), dann Antwort/Rechte/Cooldown unter dem neuen Namen speichern
                await api(`/commands/${r.command}/rename`, { method: "PUT", channel, body: { newName } });
                name = newName;
            }
            await api(`/commands/${name}`, { method: "PUT", channel, body: { response: draft.response, permission: draft.permission, cooldown: draft.cooldown } });
            setSaved(true);
            reload();
            reloadAliases?.();
        } catch (e) {
            setErr(e.message);
        }
    }

    return (
        <div className="cmd-edit">
                    <div className="cmd-edit-body">
                            <div className="cmd-field">
                                <label>Befehlsname</label>
                                <div className="cmd-prefix-input">
                                    <span>{meta.prefix}</span>
                                    <input value={draft.command} maxLength={50} onChange={(e) => setDraft({ ...draft, command: e.target.value.replace(/\s/g, "") })} />
                                </div>
                                <small>Name ändern = umbenennen (Aliase und Aufrufzähler bleiben erhalten). <span className="cmd-count">{draft.command.length} / 50</span></small>
                            </div>
                            <div className="cmd-field">
                                <label>Benutzerstufe</label>
                                <select value={draft.permission} onChange={(e) => setDraft({ ...draft, permission: e.target.value })}>
                                    {Object.values(meta.permissions).map((p) => <option key={p}>{p}</option>)}
                                </select>
                                <small>Minimales Benutzerlevel, um den Befehl ausführen zu können.</small>
                            </div>
                            <div className="cmd-field">
                                <label>Antwort</label>
                                <textarea rows={4} maxLength={500} value={draft.response} onChange={(e) => setDraft({ ...draft, response: e.target.value })} />
                                <small>Dies ist deine Befehlsantwort. Unterstützt Platzhalter wie {"{user}"}, {"{args}"}, {"{count}"} (siehe „Platzhalter“ oben). <span className="cmd-count">{draft.response.length} / 500</span></small>
                            </div>
                            <div className="cmd-field">
                            <label>Cooldown (Sekunden)</label>
                            <input type="number" min="0" value={draft.cooldown} onChange={(e) => setDraft({ ...draft, cooldown: Number(e.target.value) })} />
                            <small>Wartezeit, bis der Befehl erneut ausgelöst werden kann.</small>
                        </div>
                            <div className="cmd-field">
                                <label>Aliase</label>
                                <div>
                                    {aliases.length === 0 && <span className="hint">Keine Aliase</span>}
                                    {aliases.map((a) => (
                                        <span key={a} className="alias-chip">
                                            {meta.prefix}{a}
                                            <button type="button" className="chip-x" title={`Alias ${meta.prefix}${a} löschen`} onClick={() => removeAlias(a)}>✕</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="cmd-prefix-input">
                                    <span>{meta.prefix}</span>
                                    <input placeholder="neuer Alias" value={newAlias} onChange={(e) => setNewAlias(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") addAlias(e); }} />
                                    <button type="button" onClick={addAlias} disabled={!newAlias.trim()}>Hinzufügen</button>
                                </div>
                                {aliasErr && <p className="error">{aliasErr}</p>}
                                <small>Weitere Namen, unter denen derselbe Befehl erreichbar ist.</small>
                            </div>
                        </div>
                    {err && <p className="error">{err}</p>}
                    <div className="cmd-edit-footer">
                        {saved && <span className="cmd-saved">Gespeichert ✓</span>}
                        <button type="button" onClick={save} disabled={!draft.response.trim()}>Speichern</button>
                    </div>
                </div>);
}

function CommandRow({ r, meta, channel, reload, aliases, reloadAliases, toggleEnabled, remove }) {
    const [open, setOpen] = useState(false);
    const off = r.enabled === false;
    return (
        <>
            <tr className={"cmd-row" + (off ? " disabled-row" : "") + (open ? " open" : "")} onClick={() => setOpen(!open)}>
                <td onClick={(e) => e.stopPropagation()}>
                    <label className="switch" title={off ? "Einschalten" : "Ausschalten"}>
                        <input type="checkbox" checked={!off} onChange={() => toggleEnabled(r)} />
                        <span className="slider" />
                    </label>
                </td>
                <td><strong>{meta.prefix}{r.command}</strong></td>
                <td className="cmd-resp-cell">{r.response}</td>
                <td>{r.cooldown}s</td>
                <td>{r.uses ?? 0}</td>
                <td>{meta.permissions[r.permission]}</td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn danger" title="Löschen" onClick={() => remove(r.command)}>🗑</button>
                </td>
                <td className="chevron"><span className={"collapsible-arrow" + (open ? " open" : "")}>▶</span></td>
            </tr>
            {open && (
                <tr className="cmd-edit-row">
                    <td colSpan={8}>
                        <CommandEditor r={r} meta={meta} channel={channel} reload={reload} aliases={aliases} reloadAliases={reloadAliases} />
                    </td>
                </tr>
            )}
        </>
    );
}

export function Commands({ channel, meta }) {
    const { rows, reload, error, setError } = useList("/commands", channel);
    const aliasList = useList("/aliases", channel);
    const reloadAliases = aliasList.reload;
    const aliasesOf = (cmd) => aliasList.rows.filter((a) => a.command === cmd).map((a) => a.alias);
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    const empty = { command: "", response: "", permission: "everyone", cooldown: 5 };
    const [form, setForm] = useState(empty);
    const [editing, setEditing] = useState(null);
    const [query, setQuery] = useState("");
    const [permFilter, setPermFilter] = useState("");
    const [stateFilter, setStateFilter] = useState("");
    const isMobile = useIsMobile();
    const [openCmd, setOpenCmd] = useState(null); // Handy: aufgeklappter Command (zeigt Bearbeiten/Löschen)
    const shownRows = rows.filter((r) =>
        matchesQuery(query, r.command, r.response, aliasesOf(r.command).join(" ")) &&
        (permFilter === "" || String(r.permission ?? 0) === permFilter) &&
        (stateFilter === "" || (stateFilter === "on") === (r.enabled !== false)));

    async function save(e) {
        e.preventDefault();
        setError("");
        try {
            if (editing) {
                await api(`/commands/${editing}`, { method: "PUT", channel, body: form });
            } else {
                await api("/commands", { method: "POST", channel, body: form });
            }
            setForm(empty);
            setEditing(null);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(name) {
        if (!confirm(`!${name} wirklich löschen (inkl. Aliase)?`)) return;
        await api(`/commands/${name}`, { method: "DELETE", channel });
        reload();
        reloadAliases();
    }

    async function toggleEnabled(r) {
        await api(`/commands/${r.command}/enabled`, { method: "PUT", channel, body: { enabled: !r.enabled } });
        reload();
    }

    async function toggleAll(enabled) {
        if (!confirm(enabled ? "Wirklich ALLE Commands aktivieren?" : "Wirklich ALLE Commands deaktivieren?")) return;
        await api("/commands/enabled-all", { method: "PUT", channel, body: { enabled } });
        reload();
    }

    function startEdit(r) {
        setEditing(r.command);
        setForm({ command: r.command, response: r.response, permission: meta.permissions[r.permission], cooldown: r.cooldown });
    }

    return (
        <section>
            <h2>Custom Commands</h2>
            {settings && (
                <Collapsible title="Command-Einstellungen">
                    <div className="panel settings-panel">
                        <NumberSetting label="Cooldown für eingebaute Commands (Sekunden)" field={settings.cooldown}
                            onChange={(v) => patchSettings({ cooldown: v })} onReset={() => patchSettings({ cooldown: null })} />
                        <NumberSetting label="!raid: Follower-Modus aus für (Minuten)" field={settings.raidMinutes}
                            onChange={(v) => patchSettings({ raidMinutes: v })} onReset={() => patchSettings({ raidMinutes: null })} />
                        <NumberSetting label="!raid: danach Follower-Modus wieder an, Mindest-Gefolgt-Zeit (Minuten)" field={settings.followModeMinutes}
                            onChange={(v) => patchSettings({ followModeMinutes: v })} onReset={() => patchSettings({ followModeMinutes: null })} />
                        <NumberSetting label="Raid-Alert erst ab (Zuschauer)" field={settings.raidMinViewers}
                            onChange={(v) => patchSettings({ raidMinViewers: v })} onReset={() => patchSettings({ raidMinViewers: null })} />
                        <BoolSetting label="Automatisch bei Raid: Follower-Modus wie bei !raid vorübergehend aus" field={settings.autoRaidEnabled}
                            onChange={(v) => patchSettings({ autoRaidEnabled: v })} onReset={() => patchSettings({ autoRaidEnabled: null })} />
                        {settings.autoRaidEnabled.value && (
                            <NumberSetting label="Automatischer Raid-Schutz erst ab (Zuschauer)" field={settings.autoRaidMinViewers}
                                onChange={(v) => patchSettings({ autoRaidMinViewers: v })} onReset={() => patchSettings({ autoRaidMinViewers: null })} />
                        )}
                    </div>
                </Collapsible>
            )}
            <MobileHint title="Platzhalter">
                <p className="hint">
                    Platzhalter in der Antwort: <code>{"{user}"}</code> Aufrufer, <code>{"{touser}"}</code> erstes Argument (sonst Aufrufer), <code>{"{args}"}</code> alle Argumente,{" "}
                    <code>{"{channel}"}</code>, <code>{"{count}"}</code> Aufrufe, <code>{"{counter:name}"}</code> Zähler, <code>{"{random:1-100}"}</code> Zufallszahl,{" "}
                    <code>{"{pick:Ja|Nein|Vielleicht}"}</code> Zufallsauswahl, <code>{"{game}"}</code>, <code>{"{title}"}</code>, <code>{"{viewers}"}</code>, <code>{"{uptime}"}</code>, <code>{"{time}"}</code>, <code>{"{date}"}</code>.
                </p>
            </MobileHint>
            <form className="row" onSubmit={save}>
                <input placeholder="name" value={form.command} disabled={!!editing} onChange={(e) => setForm({ ...form, command: e.target.value })} required />
                <input className="grow" placeholder="Antwort (Platzhalter siehe oben)" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} required />
                <select value={form.permission} onChange={(e) => setForm({ ...form, permission: e.target.value })}>
                    {Object.values(meta.permissions).map((p) => <option key={p}>{p}</option>)}
                </select>
                <input type="number" min="0" title="Cooldown (Sekunden)" value={form.cooldown} onChange={(e) => setForm({ ...form, cooldown: Number(e.target.value) })} />
                <button type="submit">{editing ? "Speichern" : "Hinzufügen"}</button>
                {editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>Abbrechen</button>}
            </form>
            {error && <p className="error">{error}</p>}
            <div className="row">
                <button onClick={() => toggleAll(true)}>Alle aktivieren</button>
                <button onClick={() => toggleAll(false)}>Alle deaktivieren</button>
            </div>
            <FilterBar query={query} setQuery={setQuery} shown={shownRows.length} total={rows.length}
                active={!!query || permFilter !== "" || stateFilter !== ""}
                onClear={() => { setQuery(""); setPermFilter(""); setStateFilter(""); }}
                placeholder="Name oder Antwort suchen ...">
                <select value={permFilter} onChange={(e) => setPermFilter(e.target.value)} title="Nach Rechten filtern">
                    <option value="">Alle Rechte</option>
                    {Object.entries(meta.permissions).map(([num, name]) => <option key={num} value={num}>{name}</option>)}
                </select>
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} title="Nach Status filtern">
                    <option value="">An und aus</option>
                    <option value="on">Nur aktive</option>
                    <option value="off">Nur ausgeschaltete</option>
                </select>
            </FilterBar>
            {isMobile ? (
                <div className="cmd-list">
                    {shownRows.map((r) => {
                        const open = openCmd === r.command;
                        return (
                            <div key={r.command} className={"cmd-card" + (open ? " open" : "") + (r.enabled === false ? " disabled-row" : "")}>
                                <div className="cmd-card-head" onClick={() => setOpenCmd(open ? null : r.command)}>
                                    <span className={"collapsible-arrow" + (open ? " open" : "")}>▶</span>
                                    <strong>{meta.prefix}{r.command}</strong>
                                    <span className="cmd-meta">{meta.permissions[r.permission]} · {r.cooldown}s</span>
                                    <label className="setting" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" checked={r.enabled !== false} onChange={() => toggleEnabled(r)} />
                                    </label>
                                </div>
                                <p className="cmd-response" onClick={() => setOpenCmd(open ? null : r.command)}>{r.response}</p>
                                {open && (
                                    <div className="cmd-actions-edit">
                                        <CommandEditor r={r} meta={meta} channel={channel} reload={reload} aliases={aliasesOf(r.command)} reloadAliases={reloadAliases} />
                                        <button className="danger" onClick={() => remove(r.command)}>Löschen</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <table className="customcommands-table cmd-table">
                    <thead><tr><th></th><th>Befehl</th><th>Antwort</th><th>CD</th><th>Aufrufe</th><th>Rechte</th><th></th><th></th></tr></thead>
                    <tbody>
                        {shownRows.map((r) => (
                            <CommandRow key={r.command} r={r} meta={meta} channel={channel} reload={reload}
                                aliases={aliasesOf(r.command)} reloadAliases={reloadAliases}
                                toggleEnabled={toggleEnabled} remove={remove} />
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export function Counters({ channel }) {
    const { rows, reload, error, setError } = useList("/counters", channel);
    const [form, setForm] = useState({ name: "", inc: 1, start: 0 });
    const [editing, setEditing] = useState(null); // { name, value, inc }
    const [query, setQuery] = useState("");
    const isMobile = useIsMobile();
    const shownRows = rows.filter((r) => matchesQuery(query, r.name));

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/counters", { method: "POST", channel, body: form });
            setForm({ name: "", inc: 1, start: 0 });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function save(e) {
        e.preventDefault();
        setError("");
        try {
            await api(`/counters/${editing.name}`, { method: "PUT", channel, body: { value: editing.value, inc: editing.inc } });
            setEditing(null);
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(name) {
        if (!confirm(`Zähler "${name}" wirklich löschen?`)) return;
        await api(`/counters/${name}`, { method: "DELETE", channel });
        reload();
    }

    return (
        <section>
            <h2>Zähler</h2>
            <MobileHint>
                <p className="hint">Antworten können einen Zähler per <code>{"{counter:name}"}</code> einbinden – jeder Aufruf erhöht ihn um "Schritt".</p>
                <p className="hint">
                    Beim Anlegen: <strong>Startwert</strong> ist der Wert, mit dem der Zähler beginnt (z. B. 0).{" "}
                    <strong>Schritt</strong> ist die Zahl, um die er sich bei jedem Aufruf erhöht (meist 1, kann aber auch größer oder negativ sein).
                </p>
            </MobileHint>
            <form className="row" onSubmit={add}>
                <input placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <input type="number" title="Startwert" value={form.start} onChange={(e) => setForm({ ...form, start: Number(e.target.value) })} />
                <input type="number" title="Schritt" value={form.inc} onChange={(e) => setForm({ ...form, inc: Number(e.target.value) })} />
                <button type="submit">Hinzufügen</button>
            </form>
            {error && <p className="error">{error}</p>}
            <FilterBar query={query} setQuery={setQuery} shown={shownRows.length} total={rows.length} active={!!query}
                onClear={() => setQuery("")} placeholder="Zähler suchen ..." />
            {isMobile ? (
                <CardList rows={shownRows} rowKey={(r) => r.name}
                    title={(r) => r.name} meta={(r) => `Wert: ${r.cur}`}
                    details={(r) => <span>Schritt: {r.inc}</span>}
                    actions={(r) => (
                        <>
                            <button onClick={() => { setEditing({ name: r.name, value: r.cur, inc: r.inc }); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Bearbeiten</button>
                            <button className="danger" onClick={() => remove(r.name)}>Löschen</button>
                        </>
                    )} />
            ) : (
                <table>
                    <thead><tr><th>Name</th><th>Wert</th><th>Schritt</th><th></th></tr></thead>
                    <tbody>
                        {shownRows.map((r) => (
                            <tr key={r.name}>
                                <td>{r.name}</td>
                                <td>{r.cur}</td>
                                <td>{r.inc}</td>
                                <td className="actions">
                                    <button onClick={() => setEditing({ name: r.name, value: r.cur, inc: r.inc })}>Bearbeiten</button>
                                    <button className="danger" onClick={() => remove(r.name)}>Löschen</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {editing && (
                <form className="panel" onSubmit={save}>
                    <h3>Zähler "{editing.name}" bearbeiten</h3>
                    <div className="row">
                        <label className="setting">Wert
                            <input type="number" value={editing.value} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} />
                        </label>
                        <label className="setting">Schritt
                            <input type="number" value={editing.inc} onChange={(e) => setEditing({ ...editing, inc: Number(e.target.value) })} />
                        </label>
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

/** "1 Std. 5 Min. 3 Sek." aus Sekunden */
function fmtDuration(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return [h && `${h} Std.`, m && `${m} Min.`, (sec || (!h && !m)) && `${sec} Sek.`].filter(Boolean).join(" ");
}

export function Timers({ channel }) {
    const { rows, reload, error, setError } = useList("/timers", channel);
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    const [form, setForm] = useState({ duration: "", text: "" });
    const [tick, setTick] = useState(0); // zählt die Restzeit sekündlich herunter
    const [loadedAt, setLoadedAt] = useState(Date.now());
    const isMobile = useIsMobile();

    useEffect(() => setLoadedAt(Date.now()), [rows]);
    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 1000);
        const r = setInterval(reload, 15000); // abgelaufene Timer verschwinden, neue (z. B. per !timer im Chat) erscheinen
        return () => { clearInterval(t); clearInterval(r); };
    }, [reload]);
    const remaining = (t) => Math.max(0, t.remainingSeconds - Math.floor((Date.now() - loadedAt) / 1000));
    void tick;

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/timers", { method: "POST", channel, body: form });
            setForm({ duration: "", text: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function cancel(id) {
        setError("");
        try {
            await api(`/timers/${id}`, { method: "DELETE", channel });
        } catch (err) {
            setError(err.message);
        }
        reload();
    }

    async function cancelAll() {
        if (!confirm("Wirklich ALLE laufenden Timer abbrechen?")) return;
        await api("/timers", { method: "DELETE", channel });
        reload();
    }

    return (
        <section>
            <h2>Timer</h2>
            {settings && <StatusToggle field={settings.timersEnabled} onChange={(v) => patchSettings({ timersEnabled: v })} />}
            <MobileHint>
                <p className="hint">
                    Ein Timer schreibt nach Ablauf deinen Text in den Chat (z. B. „Pause vorbei"). Dauer zum Beispiel <code>10m</code>, <code>1h30m</code>,{" "}
                    <code>90s</code> oder nur <code>5</code> (= Minuten), höchstens 24 Stunden, bis zu 10 Timer gleichzeitig. Im Chat geht dasselbe mit <code>!timer 10m Text</code>.
                    Die Timer laufen auch nach einem Neustart des Bots weiter. Ist der Schalter aus, lassen sich keine neuen Timer starten (weder hier noch per Chat); bereits laufende Timer laufen noch ab.
                </p>
            </MobileHint>
            <form className="row" onSubmit={add}>
                <input placeholder="Dauer, z. B. 10m" title="10m, 1h30m, 90s oder Minuten" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required />
                <input className="grow" placeholder="Text für den Chat" maxLength={400} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required />
                <button type="submit">Timer starten</button>
            </form>
            {error && <p className="error">{error}</p>}
            {rows.length === 0 ? (
                <p className="hint">Es läuft kein Timer.</p>
            ) : (
                <>
                    {isMobile ? (
                        <CardList rows={rows} rowKey={(t) => t.id}
                            title={(t) => t.text} meta={(t) => `noch ${fmtDuration(remaining(t))}`}
                            details={(t) => <span>Von {t.owner ?? "?"}</span>}
                            actions={(t) => <button className="danger" onClick={() => cancel(t.id)}>Abbrechen</button>} />
                    ) : (
                        <table>
                            <thead><tr><th>#</th><th>Text</th><th>Restzeit</th><th>Von</th><th></th></tr></thead>
                            <tbody>
                                {rows.map((t, i) => (
                                    <tr key={t.id}>
                                        <td>{i + 1}</td>
                                        <td>{t.text}</td>
                                        <td>{fmtDuration(remaining(t))}</td>
                                        <td>{t.owner ?? "?"}</td>
                                        <td className="actions"><button className="danger" onClick={() => cancel(t.id)}>Abbrechen</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <div className="row"><button className="danger" onClick={cancelAll}>Alle abbrechen</button></div>
                </>
            )}
        </section>
    );
}
