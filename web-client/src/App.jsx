import { Component, useEffect, useState } from "react";
import { api, getToken, getUsername, getIsAdmin, getIsOwner, clearSession } from "./api";
import { Login } from "./Login.jsx";
import { ToastHost } from "./components/ToastHost.jsx";
import { StatusOverview } from "./tabs/Overview.jsx";
import { CommandsSection } from "./tabs/Commands.jsx";
import { Blacklist, Filters } from "./tabs/Blacklist.jsx";
import { Automessages } from "./tabs/Automessages.jsx";
import { Quotes } from "./tabs/Quotes.jsx";
import { Greetings } from "./tabs/Greetings.jsx";
import { BotMods } from "./tabs/BotMods.jsx";
import { ActionsSection } from "./tabs/Actions.jsx";
import { AccountPanel } from "./tabs/Account.jsx";
import { Users } from "./tabs/Users.jsx";
import { Backup } from "./tabs/Backup.jsx";
import { AuditLog } from "./tabs/AuditLog.jsx";
import { Alerts } from "./tabs/Alerts.jsx";
import { LoyaltySection } from "./tabs/Loyalty.jsx";
import { Stats, ModerationStats } from "./tabs/Stats.jsx";

/**
 * Hauptreiter mit Unterreitern. Gibt es nur einen sichtbaren Unterreiter, wird die Unterleiste ausgeblendet.
 * admin: nur Admins/Haupt-Admin, owner: nur Haupt-Admin.
 */
export function buildGroups({ channel, meta }) {
    return [
        { id: "Übersicht", subs: [{ id: "Übersicht", render: () => <StatusOverview channel={channel} /> }] },
        { id: "Chat", subs: [
            { id: "Commands", render: () => <CommandsSection channel={channel} meta={meta} /> },
            { id: "Automessages", render: () => <Automessages channel={channel} /> },
            { id: "Zitate", render: () => <Quotes channel={channel} /> },
            { id: "Alerts", render: () => <Alerts channel={channel} /> },
            { id: "Begrüßungen", admin: true, render: () => <Greetings channel={channel} /> },
        ] },
        { id: "Moderation", subs: [
            { id: "Blacklist", render: () => <Blacklist channel={channel} meta={meta} /> },
            { id: "Filter", render: () => <Filters channel={channel} /> },
            { id: "Verify-Mods", admin: true, render: () => <BotMods channel={channel} /> },
            { id: "Auswertung", admin: true, render: () => <ModerationStats channel={channel} /> },
        ] },
        { id: "Community", subs: [
            { id: "Loyalty System", render: () => <LoyaltySection channel={channel} /> },
            { id: "Aktionen", render: () => <ActionsSection channel={channel} meta={meta} /> },
        ] },
        { id: "Statistiken", subs: [{ id: "Statistiken", render: () => <Stats channel={channel} /> }] },
        { id: "Verwaltung", admin: true, subs: [
            { id: "Benutzer", render: () => <Users /> },
            { id: "Audit-Log", render: () => <AuditLog /> },
            { id: "Sicherung", render: () => <Backup channel={channel} /> },
        ] },
    ];
}

/**
 * Fängt Render-Fehler innerhalb eines Tabs ab, damit ein einzelner Bug nicht die komplette Seite
 * leerräumt (schwarzer Bildschirm/nur Hintergrund) - stattdessen eine Fehlermeldung mit Reset-Button.
 * resetKey (hier: der Tab-Name) setzt den Fehlerzustand beim Wechsel automatisch wieder zurück.
 */
class TabErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("Fehler im Tab:", error, info);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }
    render() {
        if (this.state.error) {
            return (
                <div className="panel error">
                    <h3>Dieser Tab konnte nicht geladen werden.</h3>
                    <p>{this.state.error.message}</p>
                    <button onClick={() => this.setState({ error: null })}>Erneut versuchen</button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function App() {
    const [authed, setAuthed] = useState(!!getToken());
    const [meta, setMeta] = useState(null);
    const [channel, setChannel] = useState("");
    // Sichtbare Hauptreiter/Unterreiter nach Rolle filtern
    const allowed = (x) => (!x.admin || getIsAdmin()) && (!x.owner || getIsOwner());
    const GROUPS = buildGroups({ channel, meta })
        .filter(allowed)
        .map((g) => ({ ...g, subs: g.subs.filter(allowed) }))
        .filter((g) => g.subs.length > 0);
    const [tab, setTab] = useState("Übersicht");
    const [subTabs, setSubTabs] = useState({}); // zuletzt gewählter Unterreiter je Hauptreiter
    const group = GROUPS.find((g) => g.id === tab) ?? GROUPS[0];
    const sub = group.subs.find((x) => x.id === subTabs[group.id]) ?? group.subs[0];
    const [error, setError] = useState("");
    const [showAccount, setShowAccount] = useState(false);
    const [twitchAuthNotice, setTwitchAuthNotice] = useState(null); // { ok, message }

    useEffect(() => {
        if (!authed) return;
        api("/meta")
            .then((m) => {
                setMeta(m);
                setChannel((c) => c || m.channels[0] || "");
            })
            .catch((e) => {
                setError(e.message);
                clearSession();
                setAuthed(false);
            });
    }, [authed]);

    // Rückmeldung vom Twitch-OAuth-Redirect (Tab "Benutzer" -> "Anwendung autorisieren") in der URL auswerten.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get("twitchAuth");
        if (!status) return;
        const channelName = params.get("channel");
        const messages = {
            success: `Twitch-Autorisierung für "${channelName}" war erfolgreich. Der Token wurde gespeichert.`,
            "bot-success": `Bot-Account${params.get("message") ? ` "${params.get("message")}"` : ""} wurde autorisiert. Er führt jetzt Löschen, Timeout, Ban und den Raid-Follower-Modus aus (für die Moderator-Statistik den Bot einmal neu starten).`,
            "wrong-account": params.get("message") || "Es wurde der falsche Twitch-Account autorisiert.",
            error: params.get("message") || "Die Twitch-Autorisierung ist fehlgeschlagen.",
        };
        setTwitchAuthNotice({ ok: status === "success" || status === "bot-success", message: messages[status] ?? messages.error });
        params.delete("twitchAuth");
        params.delete("channel");
        params.delete("message");
        const rest = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }, []);

    function logout() {
        clearSession();
        setAuthed(false);
    }

    if (!authed) return <Login onLogin={() => setAuthed(true)} error={error} />;
    if (!meta) return <p className="center">Lade ...</p>;

    return (
        <div className="app">
            <header>
                <div className="header-top">
                    <div className="header-left">
                        <h1>Blizzbot</h1>
                        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                            {meta.channels.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="header-right">
                        <span className="whoami">{getUsername()}{getIsOwner() ? " (Haupt-Admin)" : getIsAdmin() ? " (Admin)" : ""}</span>
                        <button onClick={() => setShowAccount(true)}>Konto</button>
                        <button className="danger" onClick={logout}>Abmelden</button>
                    </div>
                </div>
                {/* Große Bildschirme: Reiterleiste; Handy: Auswahlmenü (siehe .nav-select in App.css) */}
                <nav>
                    {GROUPS.map((g) => (
                        <button key={g.id} className={g.id === group.id ? "active" : ""} onClick={() => setTab(g.id)}>{g.id}</button>
                    ))}
                </nav>
                <select className="nav-select" aria-label="Bereich wählen" value={group.id} onChange={(e) => setTab(e.target.value)}>
                    {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}
                </select>
                {group.subs.length > 1 && (
                    <div className="subnav main-subnav">
                        {group.subs.map((x) => (
                            <button key={x.id} className={x.id === sub.id ? "active" : ""} onClick={() => setSubTabs((p) => ({ ...p, [group.id]: x.id }))}>{x.id}</button>
                        ))}
                    </div>
                )}
            </header>
            <ToastHost />
            {showAccount && <AccountPanel onClose={() => setShowAccount(false)} />}
            {twitchAuthNotice && (
                <p className={twitchAuthNotice.ok ? "hint" : "error"}>
                    {twitchAuthNotice.message}{" "}
                    <button onClick={() => setTwitchAuthNotice(null)}>Ausblenden</button>
                </p>
            )}
            <main>
                <TabErrorBoundary resetKey={`${group.id}/${sub.id}`}>
                    {sub.render()}
                </TabErrorBoundary>
            </main>
        </div>
    );
}
