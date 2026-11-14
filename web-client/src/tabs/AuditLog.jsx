import { useEffect, useState } from "react";
import { api } from "../api";
import { FilterBar, useIsMobile, CardList } from "../components/common.jsx";

export function formatAuditDetails(details) {
    if (!details || typeof details !== "object") return "–";
    const parts = Object.entries(details)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    return parts.length ? parts.join(" · ") : "–";
}

export function AuditLog() {
    const LIMIT = 15;
    const isMobile = useIsMobile();
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ rows: [], total: 0 });
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const ACTION_LABELS = { create: "angelegt", edit: "bearbeitet", delete: "gelöscht", stop: "gestoppt", draw: "gezogen", end: "beendet", lock: "gesperrt", resolve: "ausgewertet", cancel: "abgebrochen", export: "exportiert", import: "importiert" };
    const TYPE_LABELS = {
        command: "Command", alias: "Alias", counter: "Zähler", user: "Benutzer",
        "user-channels": "Kanalrechte", "link-permit": "Link-Freigabe", "bot-mod": "Verify-Mod", giveaway: "Giveaway", poll: "Umfrage", prediction: "Wette", quote: "Zitat", backup: "Sicherung", greeting: "Begrüßung", "bot-mod": "Bot-Moderator", watchtime: "Watchtime",
    };

    // Suchtext erst kurz nach dem Tippen an den Server schicken; jeder neue Filter springt zurück auf Seite 1
    useEffect(() => {
        const t = setTimeout(() => setDebounced(query), 300);
        return () => clearTimeout(t);
    }, [query]);
    useEffect(() => { setPage(1); }, [debounced, actionFilter, typeFilter]);

    useEffect(() => {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        if (debounced.trim()) params.set("q", debounced.trim());
        if (actionFilter) params.set("action", actionFilter);
        if (typeFilter) params.set("type", typeFilter);
        let stale = false;
        api(`/audit-log?${params}`).then((d) => { if (!stale) { setData(d); setError(""); } }).catch((e) => { if (!stale) setError(e.message); });
        return () => { stale = true; };
    }, [page, debounced, actionFilter, typeFilter]);

    const pageCount = Math.max(1, Math.ceil(data.total / LIMIT));

    return (
        <section>
            <h2>Audit-Log</h2>
            <p className="hint">
                Protokoll aller Verwaltungsänderungen (Dashboard, Twitch-Chat &amp; Discord). Einträge älter als 3 Tage werden automatisch gelöscht.
            </p>
            {error && <p className="error">{error}</p>}
            <FilterBar query={query} setQuery={setQuery} shown={data.total} total={data.total}
                active={!!query || !!actionFilter || !!typeFilter}
                onClear={() => { setQuery(""); setDebounced(""); setActionFilter(""); setTypeFilter(""); }}
                placeholder="Benutzer, Ziel oder Kanal suchen ...">
                <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} title="Nach Aktion filtern">
                    <option value="">Alle Aktionen</option>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} title="Nach Typ filtern">
                    <option value="">Alle Typen</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </FilterBar>
            {isMobile ? (
                <CardList rows={data.rows} rowKey={(e) => e.id}
                    title={(e) => `${ACTION_LABELS[e.action] ?? e.action} · ${TYPE_LABELS[e.targetType] ?? e.targetType}`}
                    meta={(e) => new Date(e.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    preview={(e) => `${e.actor}${e.target ? ` → ${e.target}` : ""}`}
                    details={(e) => (
                        <>
                            <div><span className="hint">Zeitpunkt: </span>{new Date(e.createdAt).toLocaleString("de-DE")}</div>
                            <div><span className="hint">Wer: </span>{e.actor}</div>
                            <div><span className="hint">Ziel: </span>{e.target ?? "–"}</div>
                            <div><span className="hint">Kanal: </span>{e.channel ?? "–"}</div>
                            <div><span className="hint">Details: </span>{formatAuditDetails(e.details)}</div>
                        </>
                    )} />
            ) : (
                <div className="audit-scroll"><table className="audit-table">
                    <thead><tr><th>Zeitpunkt</th><th>Wer</th><th>Aktion</th><th>Typ</th><th>Ziel</th><th>Kanal</th><th>Details</th></tr></thead>
                    <tbody>
                        {data.rows.map((e) => (
                            <tr key={e.id}>
                                <td>{new Date(e.createdAt).toLocaleString("de-DE")}</td>
                                <td>{e.actor}</td>
                                <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                                <td>{TYPE_LABELS[e.targetType] ?? e.targetType}</td>
                                <td>{e.target ?? "–"}</td>
                                <td>{e.channel ?? "–"}</td>
                                <td>{formatAuditDetails(e.details)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            )}
            {data.total > LIMIT && (
                <div className="row">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Zurück</button>
                    <span className="hint">Seite {page} von {pageCount}</span>
                    <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Weiter →</button>
                </div>
            )}
        </section>
    );
}
