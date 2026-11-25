import { useCallback, useEffect, useState } from "react";
import { api, toast } from "../api";
import { Card, StatRow } from "../components/common.jsx";

/** Reiter "Statistiken" mit Unterpunkten Aktuell (Live-Zahlen) / Verlauf (wie oft was gemacht wurde). */
export function Stats({ channel }) {
    const [sub, setSub] = useState("Aktuell");
    const SUBS = ["Aktuell", "Verlauf"];
    return (
        <div>
            <h2>Statistiken</h2>
            <div className="subnav">
                {SUBS.map((s) => (
                    <button key={s} className={s === sub ? "active" : ""} onClick={() => setSub(s)}>{s}</button>
                ))}
            </div>
            {sub === "Aktuell" && <CurrentStats channel={channel} />}
            {sub === "Verlauf" && <HistoryStats channel={channel} />}
        </div>
    );
}

export function CurrentStats({ channel }) {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/stats", { channel }).then(setStats).catch((e) => setError(e.message));
    }, [channel]);

    if (error) return <p className="error">{error}</p>;
    if (!stats) return <p>Lade ...</p>;

    const c = stats.eventCounts;
    const max = Math.max(1, ...stats.commandsPerDay.map((d) => d.count));

    return (
        <section>
            <div className="cards">
                <Card label="Verschenkte Subs" value={stats.totalSubs} />
                <Card label="Neue Subs" value={c.alert_sub ?? 0} />
                <Card label="Resubs" value={c.alert_resub ?? 0} />
                <Card label="Bits gesamt" value={stats.totalBits} />
                <Card label="Raids" value={c.alert_raid ?? 0} />
                <Card label="Raid-Zuschauer" value={stats.totalRaidViewers} />
                <Card label="Command-Nutzungen" value={c.command ?? 0} />
                <Card label="Blacklist-Treffer" value={c.blacklist_hit ?? 0} />
                <Card label="Chatnachrichten" value={c.message ?? 0} />
            </div>

            <h3>Top-Commands</h3>
            <table>
                <thead><tr><th>Command</th><th>Nutzungen</th></tr></thead>
                <tbody>{stats.topCommands.map((t) => <tr key={t.command}><td>!{t.command}</td><td>{t.count}</td></tr>)}</tbody>
            </table>

            <h3>Commands pro Tag (14 Tage)</h3>
            <div className="bars">
                {stats.commandsPerDay.map((d) => (
                    <div key={d.day} className="bar" title={`${d.day}: ${d.count}`}>
                        <div style={{ height: `${(d.count / max) * 100}%` }} />
                        <span>{d.day.slice(5)}</span>
                    </div>
                ))}
            </div>

            <h3>Letzte Alerts</h3>
            <table>
                <thead><tr><th>Zeit</th><th>Typ</th><th>Nutzer</th><th>Details</th></tr></thead>
                <tbody>
                    {stats.recentAlerts.map((a, i) => (
                        <tr key={i}>
                            <td>{new Date(a.created_at).toLocaleString("de-DE")}</td>
                            <td>{a.event_type.replace("alert_", "")}</td>
                            <td>{a.username}</td>
                            <td><code>{JSON.stringify(a.data)}</code></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

/** Verlauf: wie oft Commands/Aliase/Zähler/Zitate erstellt/bearbeitet/gelöscht wurden (Audit-Log). */
export function HistoryStats({ channel }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/stats/history", { channel }).then(setData).catch((e) => setError(e.message));
    }, [channel]);

    if (error) return <p className="error">{error}</p>;
    if (!data) return <p>Lade ...</p>;

    const TYPE_LABELS = { command: "Commands", alias: "Aliase", counter: "Zähler", quote: "Zitate" };
    const a = data.audit;

    return (
        <section>
            <h3>Verwaltung</h3>
            <p className="hint">Wie oft Commands, Aliase, Zähler und Zitate über Dashboard, Twitch-Chat oder Discord erstellt, bearbeitet oder gelöscht wurden.</p>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <StatRow key={type} label={label} items={[
                    { label: "erstellt", value: a[type]?.create ?? 0 },
                    { label: "bearbeitet", value: a[type]?.edit ?? 0 },
                    { label: "gelöscht", value: a[type]?.delete ?? 0 },
                ]} />
            ))}

            <h3>Häufigste Auslöser</h3>
            <table>
                <thead><tr><th>Auslöser</th><th>Anzahl</th></tr></thead>
                <tbody>
                    {(data.topTriggers ?? []).map((t) => (
                        <tr key={t.trigger}>
                            <td>{t.trigger === "link" ? "Nicht erlaubter Link" : t.trigger === "action" ? "/me-Nachricht" : t.trigger}</td>
                            <td>{t.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

/** Reiter "Moderation" > "Auswertung" (nur für Admins/Haupt-Admin): automatische Bot-Aktionen und Aktionen der Moderatoren. */
export function ModerationStats({ channel }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(() => {
        api("/stats/moderation", { channel }).then(setData).catch((e) => setError(e.message));
    }, [channel]);
    useEffect(load, [load]);

    async function resetMods() {
        if (!window.confirm("Alle erfassten Aktionen der einzelnen Moderatoren löschen? Das geht nur einmal pro Monat und kann nicht rückgängig gemacht werden.")) return;
        try {
            await api("/stats/moderation/reset", { method: "POST", channel, toast: "Moderator-Aktionen zurückgesetzt" });
            setError("");
            load();
        } catch (e) {
            setError(e.message);
        }
    }

    if (error && !data) return <p className="error">{error}</p>;
    if (!data) return <p>Lade ...</p>;

    const m = data.modActions;
    const mm = data.moderatorActions ?? { deleted: 0, timeouts: 0, bans: 0, perModerator: [] };

    return (
        <section>
            <h3>Moderationsaktionen</h3>
            <p className="hint">Automatische Aktionen durch Blacklist, Link-Filter und /me-Filter (siehe Moderation → Blacklist / Kanal-Einstellungen).</p>
            <StatRow label="Aktionen" items={[
                { label: "Nachrichten gelöscht", value: m.deleted ?? 0 },
                { label: "Timeouts", value: m.timeouts ?? 0 },
                { label: "Bans", value: m.bans ?? 0 },
            ]} />

            {error && <p className="error">{error}</p>}
            <div className="heading-row">
                <h4>Durch Moderatoren</h4>
                <button className="danger" disabled={!mm.canReset} onClick={resetMods}
                    title={mm.canReset ? "Alle Moderator-Aktionen löschen (einmal pro Monat möglich)" : "In diesem Monat schon geleert – erst im nächsten Monat wieder möglich"}>
                    Zurücksetzen
                </button>
            </div>
            <p className="hint">Aktionen, die Moderatoren selbst in Twitch ausgeführt haben (nicht der Bot). Erfassung läuft über Twitch EventSub und startet nach dem Update erst, wenn der Twitch-Zugang einmal neu autorisiert wurde.</p>
            <StatRow label="Aktionen" items={[
                { label: "Nachrichten gelöscht", value: mm.deleted },
                { label: "Timeouts", value: mm.timeouts },
                { label: "Bans", value: mm.bans },
            ]} />
            <p className="hint">{mm.lastReset ? `Zuletzt geleert am ${new Date(mm.lastReset).toLocaleDateString("de-DE")}.` : "Noch nie geleert."} Leeren ist einmal pro Monat möglich.</p>
            <table>
                <thead><tr><th>Moderator</th><th>Gelöscht</th><th>Timeouts</th><th>Bans</th></tr></thead>
                <tbody>
                    {(mm.perModerator ?? []).map((r) => (
                        <tr key={r.moderator}><td>{r.moderator}</td><td>{r.deleted}</td><td>{r.timeouts}</td><td>{r.bans}</td></tr>
                    ))}
                    {!(mm.perModerator ?? []).length && <tr><td colSpan={4} className="hint">Noch keine Aktionen erfasst.</td></tr>}
                </tbody>
            </table>
        </section>
    );
}
