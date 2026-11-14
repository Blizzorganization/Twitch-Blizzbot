import { useEffect, useState } from "react";
import { api } from "../api";
import { useChannelSettings, NumberSetting, BoolSetting, ListSetting, StatusToggle, Collapsible, useList, FilterBar, matchesQuery, useIsMobile, CardList } from "../components/common.jsx";

export function Blacklist({ channel, meta }) {
    const { rows, reload, error, setError } = useList("/blacklist", channel);
    const [form, setForm] = useState({ word: "", action: 0 });
    const [query, setQuery] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const isMobile = useIsMobile();
    const { settings, patch } = useChannelSettings(channel);
    const shownRows = rows.filter((r) => matchesQuery(query, r.word) && (actionFilter === "" || String(r.action) === actionFilter));

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/blacklist", { method: "POST", channel, body: form });
            setForm({ ...form, word: "" });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function changeAction(word, action) {
        await api(`/blacklist/${encodeURIComponent(word)}`, { method: "PUT", channel, body: { action: Number(action) } });
        reload();
    }

    async function remove(word) {
        await api(`/blacklist/${encodeURIComponent(word)}`, { method: "DELETE", channel });
        reload();
    }

    const options = Object.entries(meta.blacklistActions).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>);

    return (
        <section>
            <h2>Blacklist</h2>
            {settings && <StatusToggle field={settings.blacklistEnabled} onChange={(v) => patch({ blacklistEnabled: v })} />}
            <form className="row" onSubmit={add}>
                <input className="grow" placeholder="Wort" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} required />
                <select value={form.action} onChange={(e) => setForm({ ...form, action: Number(e.target.value) })}>{options}</select>
                <button type="submit">Hinzufügen</button>
            </form>
            {error && <p className="error">{error}</p>}
            <FilterBar query={query} setQuery={setQuery} shown={shownRows.length} total={rows.length}
                active={!!query || actionFilter !== ""} onClear={() => { setQuery(""); setActionFilter(""); }}
                placeholder="Wort suchen ...">
                <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} title="Nach Aktion filtern">
                    <option value="">Alle Aktionen</option>
                    {Object.entries(meta.blacklistActions).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}
                </select>
            </FilterBar>
            {isMobile ? (
                <CardList rows={shownRows} rowKey={(r) => r.word}
                    title={(r) => r.word} meta={(r) => meta.blacklistActions[r.action]}
                    details={(r) => (
                        <label className="cmd-field">Aktion
                            <select value={r.action} onChange={(e) => changeAction(r.word, e.target.value)}>{options}</select>
                        </label>
                    )}
                    actions={(r) => <button className="danger" onClick={() => remove(r.word)}>Löschen</button>} />
            ) : (
                <table>
                    <thead><tr><th>Wort</th><th>Aktion</th><th></th></tr></thead>
                    <tbody>
                        {shownRows.map((r) => (
                            <tr key={r.word}>
                                <td>{r.word}</td>
                                <td>
                                    <select value={r.action} onChange={(e) => changeAction(r.word, e.target.value)}>{options}</select>
                                </td>
                                <td className="actions"><button className="danger" onClick={() => remove(r.word)}>Löschen</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

/** Reiter "Filter": Link-Filter, Link-Freigaben und Spam-Filter (gelten nur für Nutzer ohne Rolle). */
export function Filters({ channel }) {
    const { settings, patch: patchSettings } = useChannelSettings(channel);
    return (
        <section>
            <h2>Filter</h2>
            <p className="hint">Gilt nur für Nutzer ohne Rolle (keine Mods, VIPs, Subs). Zu auffällige Nachrichten werden gelöscht.</p>
            {settings && (
                <Collapsible title="Link-Filter">
                    <div className="panel settings-panel">
                        <BoolSetting label="Link-Filter aktiv" field={settings.linkFilter}
                            onChange={(v) => patchSettings({ linkFilter: v })} onReset={() => patchSettings({ linkFilter: null })} />
                        <BoolSetting label="/me-Nachrichten von Nutzern ohne Rolle löschen" field={settings.deleteActionMessages}
                            onChange={(v) => patchSettings({ deleteActionMessages: v })} onReset={() => patchSettings({ deleteActionMessages: null })} />
                        <ListSetting label="Erlaubte Links (eine pro Zeile)" hint="Angezeigt wird die aktuell geltende Liste. Ohne eigene Liste ist das der Inhalt von configs/links.txt (für alle Kanäle); „Speichern“ legt eine eigene Liste für diesen Kanal an."
                            field={settings.allowedLinks} onChange={(v) => patchSettings({ allowedLinks: v })} onReset={() => patchSettings({ allowedLinks: null })} />
                        <ListSetting label="Domain-Endungen, die den Filter auslösen (eine pro Zeile)" hint="Angezeigt wird die aktuell geltende Liste. Ohne eigene Liste ist das der Inhalt von configs/TLDs.txt (für alle Kanäle); „Speichern“ legt eine eigene Liste für diesen Kanal an."
                            field={settings.tlds} onChange={(v) => patchSettings({ tlds: v })} onReset={() => patchSettings({ tlds: null })} />
                    </div>
                </Collapsible>
            )}
            <LinkPermits channel={channel} />
            {settings && (
                <Collapsible title="Spam-Filter (Caps, Emotes, Wiederholungen, Zeichen)">
                    <div className="panel settings-panel">
                    <h4>Caps</h4>
                    <div className="setting-group">
                        <BoolSetting label="Caps-Filter aktiv" field={settings.capsFilter}
                            onChange={(v) => patchSettings({ capsFilter: v })} onReset={() => patchSettings({ capsFilter: null })} />
                        <NumberSetting label="Caps: erst ab so vielen Buchstaben prüfen" hint="Kurze Nachrichten wie „LOL“ bleiben so unbehelligt."
                            field={settings.capsMinLength} onChange={(v) => patchSettings({ capsMinLength: v })} onReset={() => patchSettings({ capsMinLength: null })} />
                        <NumberSetting label="Caps: löschen ab so viel Prozent Großbuchstaben" hint="Nur Buchstaben zählen, Zahlen und Satzzeichen nicht."
                            field={settings.capsMaxPercent} onChange={(v) => patchSettings({ capsMaxPercent: v })} onReset={() => patchSettings({ capsMaxPercent: null })} />
                    </div>
                    <h4>Emotes</h4>
                    <div className="setting-group">
                        <BoolSetting label="Emote-Spam-Filter aktiv" field={settings.emoteFilter}
                            onChange={(v) => patchSettings({ emoteFilter: v })} onReset={() => patchSettings({ emoteFilter: null })} />
                        <NumberSetting label="Emotes: löschen bei mehr als so vielen Emotes" hint="Gezählt werden Twitch-Emotes (7TV/BTTV/FFZ nicht)."
                            field={settings.emoteMaxCount} onChange={(v) => patchSettings({ emoteMaxCount: v })} onReset={() => patchSettings({ emoteMaxCount: null })} />
                    </div>
                    <h4>Wiederholungen</h4>
                    <div className="setting-group">
                        <BoolSetting label="Wiederholungs-Filter aktiv" field={settings.repeatFilter}
                            onChange={(v) => patchSettings({ repeatFilter: v })} onReset={() => patchSettings({ repeatFilter: null })} />
                        <NumberSetting label="Wiederholungen: löschen ab dem so vielen Mal derselben Nachricht (innerhalb 60 Sekunden)" hint="Groß-/Kleinschreibung zählt nicht. Bei 3 wird die dritte gleiche Nachricht gelöscht."
                            field={settings.repeatMaxCount} onChange={(v) => patchSettings({ repeatMaxCount: v })} onReset={() => patchSettings({ repeatMaxCount: null })} />
                    </div>
                    <h4>Zeichen-Spam</h4>
                    <div className="setting-group">
                        <BoolSetting label="Zeichen-Spam-Filter aktiv" field={settings.charSpamFilter}
                            onChange={(v) => patchSettings({ charSpamFilter: v })} onReset={() => patchSettings({ charSpamFilter: null })} />
                        <NumberSetting label="Zeichen-Spam: gleiches Zeichen so oft hintereinander" hint='Z. B. "aaaaaaaaaaaaaaa" oder "!!!!!!!!!!!!!!!".'
                            field={settings.charRunMax} onChange={(v) => patchSettings({ charRunMax: v })} onReset={() => patchSettings({ charRunMax: null })} />
                        <NumberSetting label="Zeichen-Spam: löschen ab so viel Prozent Sonderzeichen" hint="Alles außer Buchstaben, Ziffern und Leerzeichen, erst ab 10 Zeichen. Reine Emoji-Nachrichten zählen als Sonderzeichen."
                            field={settings.charSymbolPercent} onChange={(v) => patchSettings({ charSymbolPercent: v })} onReset={() => patchSettings({ charSymbolPercent: null })} />
                    
                    </div>
                    </div>
                </Collapsible>
            )}
        </section>
    );
}

/** Link-Freigaben: wer gerade Links posten darf (Chat: !permit / !unpermit). */
function LinkPermits({ channel }) {
    const { rows, reload, error, setError } = useList("/link-permits", channel);
    const [name, setName] = useState("");
    const [duration, setDuration] = useState("5");
    // Abgelaufene Freigaben verschwinden serverseitig; die Liste gelegentlich neu laden, damit sie aktuell bleibt
    useEffect(() => {
        const t = setInterval(reload, 30000);
        return () => clearInterval(t);
    }, [reload]);

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            const body = { username: name.trim() };
            if (duration === "stream") body.untilOffline = true;
            else body.minutes = Number(duration);
            await api("/link-permits", { method: "POST", channel, body, toast: "Freigabe erteilt" });
            setName("");
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function revoke(username) {
        try {
            await api(`/link-permits/${encodeURIComponent(username)}`, { method: "DELETE", channel });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    const until = (r) => (r.until_offline ? "bis Stream-Ende (max. " : "bis ") + new Date(r.expires_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + (r.until_offline ? ")" : " Uhr");

    return (
        <Collapsible title={`Link-Freigaben${rows.length ? ` (${rows.length})` : ""}`}>
            <div className="panel settings-panel">
                <p className="hint">
                    Wer hier steht, darf Links posten, ohne dass der Link-Filter die Nachricht löscht. Alle anderen Filter gelten weiter.
                    Im Chat geht das auch mit <code>!permit name [10m | stream]</code> und <code>!unpermit name</code> (Mods). „Bis Stream-Ende“ gilt nur
                    während eines Streams und höchstens 12 Stunden.
                </p>
                {error && <p className="error">{error}</p>}
                <form className="row" onSubmit={add}>
                    <input placeholder="Twitch-Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} title="Dauer der Freigabe">
                        <option value="5">5 Minuten</option>
                        <option value="10">10 Minuten</option>
                        <option value="30">30 Minuten</option>
                        <option value="60">1 Stunde</option>
                        <option value="120">2 Stunden</option>
                        <option value="stream">Bis Stream-Ende</option>
                    </select>
                    <button type="submit">Freigeben</button>
                </form>
                {rows.length === 0 ? <p className="hint">Aktuell hat niemand eine Freigabe.</p> : (
                    <div className="cmd-list">
                        {rows.map((r) => (
                            <div key={r.username} className="cmd-card">
                                <div className="cmd-card-head">
                                    <strong>{r.username}</strong>
                                    <span className="cmd-meta">{until(r)}</span>
                                </div>
                                {r.granted_by && <p className="cmd-response">Freigegeben von {r.granted_by}</p>}
                                <div className="cmd-actions"><button className="danger" onClick={() => revoke(r.username)}>Entfernen</button></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Collapsible>
    );
}
