import { useState } from "react";
import { api } from "../api";
import { useList, FilterBar, matchesQuery, useIsMobile, CardList } from "../components/common.jsx";

export function Quotes({ channel }) {
    const { rows, reload, error, setError } = useList("/quotes", channel);
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");
    const isMobile = useIsMobile();
    const shownRows = rows.filter((q) => matchesQuery(query, `#${q.id}`, q.id, q.text, q.added_by));

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/quotes", { method: "POST", channel, body: { text } });
            setText("");
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(id) {
        if (!confirm(`Zitat #${id} wirklich löschen?`)) return;
        try {
            await api(`/quotes/${id}`, { method: "DELETE", channel });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>Zitate</h2>
            <p className="hint">
                Im Chat abrufbar mit <code>!zitat</code> (zufällig) oder <code>!zitat &lt;ID&gt;</code>. Hinzufügen/Löschen geht auch per
                Chat (<code>!zitat add/remove</code>, nur Mods) oder hier im Dashboard.
            </p>
            <form className="row" onSubmit={add}>
                <input className="grow" placeholder="Neues Zitat" value={text} onChange={(e) => setText(e.target.value)} required />
                <button type="submit">Hinzufügen</button>
            </form>
            {error && <p className="error">{error}</p>}
            <FilterBar query={query} setQuery={setQuery} shown={shownRows.length} total={rows.length} active={!!query}
                onClear={() => setQuery("")} placeholder="Text, Nummer oder Autor suchen ..." />
            {isMobile ? (
                <CardList rows={shownRows} rowKey={(q) => q.id}
                    title={(q) => `#${q.id}`} meta={(q) => q.added_by ?? "-"} preview={(q) => q.text}
                    actions={(q) => <button className="danger" onClick={() => remove(q.id)}>Löschen</button>} />
            ) : (
                <table>
                    <thead><tr><th>#</th><th>Zitat</th><th>Von</th><th></th></tr></thead>
                    <tbody>
                        {shownRows.map((q) => (
                            <tr key={q.id}>
                                <td>{q.id}</td>
                                <td>{q.text}</td>
                                <td>{q.added_by ?? "-"}</td>
                                <td className="actions"><button className="danger" onClick={() => remove(q.id)}>Löschen</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
