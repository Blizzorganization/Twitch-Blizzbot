import { useEffect, useState } from "react";
import { api, toast } from "../api";
import { StatusToggle, Collapsible, MobileHint } from "../components/common.jsx";

const toText = (list) => (list ?? []).join(", ");

/** Verwaltung -> Discord: Server, Admin-Rolle, Blacklist-/Say-Kanal und Embed-Farbe pro Twitch-Kanal (ein gemeinsamer Discord-Bot). */
export function Discord({ channel }) {
    const [data, setData] = useState(null);
    const [form, setForm] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false); // Felder sind erst nach "Bearbeiten" änderbar (gegen versehentliche Änderungen)

    function apply(res) {
        setData(res);
        setEditing(!res.configured); // noch nichts eingerichtet: gleich bearbeiten
        const s = res.settings;
        setForm({
            enabled: s.enabled,
            guildIds: toText(s.guildIds),
            publicGuildIds: toText(s.publicGuildIds),
            adminRoleId: s.adminRoleId ?? "",
            blacklistChannelId: s.blacklistChannelId ?? "",
            sayChannelId: s.sayChannelId ?? "",
            embedColor: s.embedColorHex ?? "",
        });
    }

    useEffect(() => {
        setData(null); setForm(null); setError("");
        api("/discord-settings", { channel }).then(apply).catch((e) => setError(e.message));
    }, [channel]);

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    async function save(overrides = {}) {
        setError(""); setBusy(true);
        try {
            const body = { ...form, ...overrides };
            const res = await api("/discord-settings", { method: "PUT", channel, body, toast: false });
            setForm(body);
            setEditing(false);
            setData((d) => ({ ...d, configured: true, settings: res.settings, status: res.status }));
            toast("Gespeichert");
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!confirm(`Die Discord-Einstellungen von "${channel}" löschen? Die Slash-Commands verschwinden dann von den eingetragenen Servern.`)) return;
        setError(""); setBusy(true);
        try {
            await api("/discord-settings", { method: "DELETE", channel, toast: false });
            apply(await api("/discord-settings", { channel }));
            toast("Gelöscht");
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    if (error && !form) return <section><h2>Discord</h2><p className="error">{error}</p></section>;
    if (!form) return <section><h2>Discord</h2><p className="hint">Lade …</p></section>;

    const st = data.status;
    return (
        <section>
            <MobileHint>
            <p className="hint">
                    Es gibt <strong>einen</strong> Discord-Bot (Token und Client-ID stehen in der <code>.env</code>). Hier legst du fest, welche Discord-Server,
                    Rollen und Kanäle zu diesem Twitch-Kanal gehören. Änderungen wirken sofort, die Slash-Commands werden automatisch neu registriert.
                    Ein Server darf nur zu einem Twitch-Kanal gehören.
                </p>
            </MobileHint>

            {!data.botEnabled && <p className="error">Der Discord-Bot ist ausgeschaltet (<code>DISCORD_ENABLED=true</code> in der <code>.env</code> setzen und neu starten).</p>}
            {data.botEnabled && !data.hasToken && <p className="error"><code>DISCORD_TOKEN</code> und <code>DISCORD_CLIENT_ID</code> fehlen in der <code>.env</code>.</p>}
            {data.botEnabled && data.hasToken && (
                <p className="hint">
                    Bot: <strong>{st.connected ? "verbunden" : "nicht verbunden"}</strong> · Server: {st.guilds} · eingerichtete Kanäle: {st.channels} · registrierte Commands: {st.registeredCommands}
                    {st.lastError ? <> · letzter Fehler: {st.lastError}</> : null}
                </p>
            )}

            {data.inviteUrl && (
                <Collapsible title="Bot zum Server hinzufügen">
                    <p className="hint">
                        Öffnet die Discord-Einladung des Bots (Scopes <code>bot</code> und <code>applications.commands</code>). Dort Server wählen und bestätigen,
                        danach die Server-ID unten eintragen und speichern. Steht schon eine Server-ID im ersten Feld (gespeichert), ist dieser Server vorausgewählt.
                    </p>
                    <p><button type="button" onClick={() => window.open(data.inviteUrl, "_blank", "noopener,noreferrer")}>Bot zu Discord-Server hinzufügen</button></p>
                </Collapsible>
            )}

            <MobileHint title="Einstellungen">
            <div className="panel">
                {/* Wie die anderen Modul-Schalter: wirkt sofort (speichert dabei die aktuellen Felder mit) */}
                {editing
                    ? <p className="hint">Discord für diesen Kanal: Status <strong>{form.enabled ? "an" : "aus"}</strong> (der Schalter ist während des Bearbeitens gesperrt – erst speichern oder abbrechen)</p>
                    : <StatusToggle label="Discord für diesen Kanal" field={{ value: form.enabled }} onChange={(v) => save({ enabled: v })} />}

                <div className="setting-sub">
                    <strong>Server (Verwaltungs-Commands: /add, /edit, /del, /view …)</strong>
                    <input type="text" disabled={!editing} value={form.guildIds} placeholder="Server-ID, weitere mit Komma" onChange={(e) => set("guildIds", e.target.value)} />
                </div>
                <div className="setting-sub">
                    <strong>Server (Nutzer-Commands: /watchtime, /profil, /top10 …) – optional</strong>
                    <input type="text" disabled={!editing} value={form.publicGuildIds} placeholder="leer = dieselben Server wie oben" onChange={(e) => set("publicGuildIds", e.target.value)} />
                    <p className="hint">Leer lassen, dann laufen alle Commands auf den Servern oben. Sonst bekommen diese Server nur die Nutzer-Commands.</p>
                </div>
                <div className="setting-sub">
                    <strong>Admin-Rolle (optional)</strong>
                    <input type="text" disabled={!editing} value={form.adminRoleId} placeholder="Rollen-ID" onChange={(e) => set("adminRoleId", e.target.value)} />
                    <p className="hint">Mitglieder mit dieser Rolle oder dem Recht „Server verwalten“ dürfen die Verwaltungs-Commands nutzen.</p>
                </div>
                <div className="setting-sub">
                    <strong>Blacklist-Kanal (optional)</strong>
                    <input type="text" disabled={!editing} value={form.blacklistChannelId} placeholder="Discord-Kanal-ID" onChange={(e) => set("blacklistChannelId", e.target.value)} />
                    <p className="hint">Hierhin schickt <code>!blacklist</code> im Twitch-Chat die Liste. Ohne Eintrag antwortet der Bot im Chat.</p>
                </div>
                <div className="setting-sub">
                    <strong>Say-Kanal (optional)</strong>
                    <input type="text" disabled={!editing} value={form.sayChannelId} placeholder="Discord-Kanal-ID" onChange={(e) => set("sayChannelId", e.target.value)} />
                    <p className="hint">Nachrichten in diesem Discord-Kanal postet der Bot 1:1 in den Twitch-Chat von {channel} (Message Content Intent im Developer Portal aktivieren).</p>
                </div>
                <div className="setting-sub">
                    <strong>Embed-Farbe (optional)</strong>
                    <input type="text" disabled={!editing} value={form.embedColor} placeholder="#edbc5d" onChange={(e) => set("embedColor", e.target.value)} />
                </div>

                {error && <p className="error">{error}</p>}
                <p>
                    {editing ? (
                        <>
                            <button onClick={() => save()} disabled={busy}>Speichern</button>{" "}
                            {data.configured && <button onClick={() => { setError(""); apply(data); }} disabled={busy}>Abbrechen</button>}
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditing(true)} disabled={busy}>Bearbeiten</button>{" "}
                            {data.configured && <button className="danger" onClick={remove} disabled={busy}>Einstellungen löschen</button>}
                        </>
                    )}
                </p>
                <p className="hint">IDs findest du in Discord mit aktiviertem Entwicklermodus: Rechtsklick → „ID kopieren“.</p>
            </div>
            </MobileHint>
        </section>
    );
}
