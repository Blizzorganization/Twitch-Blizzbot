import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export function formatUptime(sec) {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d} T ${h} Std` : h ? `${h} Std ${m} Min` : `${m} Min`;
}

/** Startseite "Übersicht": Zustand des Bots auf einen Blick (Chat, Live-Status, Module, Bot-Account, letzte Fehler). */
export function StatusOverview({ channel }) {
    const [st, setSt] = useState(null);
    const [error, setError] = useState("");
    const retries = useRef(0);
    const load = useCallback(() => {
        if (!channel) return;
        api("/status", { channel }).then((r) => {
            setSt(r);
            setError("");
            // Live-Status noch unbekannt (Twitch antwortet langsam)? Dann nach 3 s noch ein paar Mal nachfragen.
            if (!r.stream?.known && retries.current < 4) {
                retries.current += 1;
                setTimeout(load, 3000);
            } else if (r.stream?.known) {
                retries.current = 0;
            }
        }).catch((e) => setError(e.message));
    }, [channel]);
    useEffect(() => {
        load();
        const timer = setInterval(load, 15000);
        return () => clearInterval(timer);
    }, [load]);

    if (error) return <p className="error">{error}</p>;
    if (!st) return <p className="hint">Lade Status ...</p>;

    const Item = ({ label, ok, text }) => (
        <div className="card status-card">
            <span>{label}</span>
            <strong className={ok === true ? "ok" : ok === false ? "bad" : ""}>{text}</strong>
        </div>
    );
    const modLogText = st.modLog?.connected ? `Verbunden (${st.modLog.via === "bot" ? "Bot-Account" : "Streamer-Token"})` : "Getrennt";
    const spam = st.modules.spamFilters ?? [];
    // Module nach Bereich gruppiert (wie die Hauptreiter im Dashboard)
    const moduleGroups = [
        ["Chat", [
            ["Automessages", st.modules.automessage],
            ["Begrüßungen", st.modules.greetings],
            ["Timer", st.modules.timers],
        ]],
        ["Moderation", [
            ["Blacklist", st.modules.blacklist],
            ["Link-Filter", st.modules.linkFilter],
            // aktiv, sobald mindestens ein Spam-Filter (Caps/Emotes/Wiederholungen/Zeichen) an ist - dahinter stehen die aktiven
            [spam.length ? `Spam-Filter (${spam.join(", ")})` : "Spam-Filter", spam.length > 0],
            ["Verify-Mods", st.modules.verifyMods],
        ]],
        ["Loyalty", [
            ["Level-/XP-System", st.modules.leveling],
            ["Punkte-System", st.modules.points],
            ["Watchtime", st.modules.watchtime],
        ]],
    ];
    // Datum + Uhrzeit, z. B. "23.6 13:42:43"
    const stamp = (t) => {
        const d = new Date(t);
        return `${d.getDate()}.${d.getMonth() + 1} ${d.toLocaleTimeString("de-DE")}`;
    };
    return (
        <section>
            <h3>Status – {channel}</h3>
            {(st.tokenProblems ?? []).map((p, i) => (
                <p key={i} className={p.level === "error" ? "error" : "hint warn"}>⚠ {p.message}</p>
            ))}
            <div className="cards">
                <Item label="Stream" ok={st.stream.known ? st.stream.live : null}
                    text={!st.stream.known ? "Unbekannt" : st.stream.live ? `Live · ${st.stream.viewers} Zuschauer` : "Offline"} />
                <Item label="Twitch-Chat" ok={st.chat.connected} text={st.chat.connected ? "Verbunden" : "Getrennt"} />
                {/* Discord ist immer sichtbar: ausgeschaltet (DISCORD_ENABLED=false) zeigt die Karte "Getrennt" statt zu verschwinden */}
                <Item label="Discord" ok={st.discord ? st.discord.connected : false}
                    text={!st.discord
                        ? "Getrennt"
                        : st.discord.connected
                            ? "Verbunden"
                            : st.discord.configured ? `Getrennt${st.discord.lastError ? " – " + st.discord.lastError : ""}` : "Unvollständig konfiguriert (Token/Client-ID/Server)"} />
                <Item label="API-Token (Kanal)" ok={st.channelToken} text={st.channelToken ? "Verbunden" : "Fehlt – unter Verwaltung → Benutzer autorisieren"} />
                {st.bot && <Item label="Bot-Account" ok={st.bot.hasToken ? true : null} text={st.bot.hasToken ? (st.bot.login ?? "Autorisiert") : "Nicht autorisiert"} />}
                <Item label="Moderator-Aktionen" ok={!!st.modLog?.connected} text={modLogText} />
                <Item label="Reward-Erfassung"
                    ok={st.modules.rewards && !st.eventSubFailure && st.eventSub}
                    text={st.modules.rewards && st.eventSubFailure ? `Getrennt – ${st.eventSubFailure}` : st.modules.rewards && st.eventSub ? "Verbunden" : "Getrennt"} />
                <Item label="Laufzeit des Bots" text={formatUptime(st.uptimeSeconds)} />
            </div>

            {st.discord?.connected && (
                <p className="hint">
                    Discord: {st.discord.guilds} Server · {st.discord.registeredCommands} Slash-Commands registriert ·
                    Blacklist-Kanal {st.discord.blacklistChannel ? "gesetzt" : "nicht gesetzt"} · Say-Kanal {st.discord.sayChannel ? "gesetzt" : "nicht gesetzt"}
                </p>
            )}

            <h4>Module</h4>
            {moduleGroups.map(([group, items]) => (
                <div key={group} className="chip-group">
                    <span className="chip-group-title">{group}</span>
                    <div className="chips">
                        {items.map(([name, on]) => (
                            <span key={name} className={"chip " + (on ? "on" : "off")}>{on ? "●" : "○"} {name}</span>
                        ))}
                    </div>
                </div>
            ))}

            {st.errors && (
                <>
                    <h4>Letzte Warnungen &amp; Fehler</h4>
                    {st.errors.length === 0 ? (
                        <p className="hint">Keine Meldungen seit dem Start.</p>
                    ) : (
                        <table className="error-table">
                            <thead><tr><th>Zeit</th><th>Art</th><th>Meldung</th></tr></thead>
                            <tbody>
                                {st.errors.map((e, i) => (
                                    <tr key={i}>
                                        <td>{stamp(e.time)}</td>
                                        <td className={e.level === "error" ? "bad" : e.level === "ok" ? "ok" : "warn"}>{e.level === "error" ? "Fehler" : e.level === "ok" ? "Info" : "Warnung"}</td>
                                        <td>{e.text}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </section>
    );
}
