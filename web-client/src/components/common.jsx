import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

/** Lädt die Pro-Kanal-Einstellungen (Cooldown, Raid, Automessage-Intervall, Link-Filter) und erlaubt Teil-Updates. */
export function useChannelSettings(channel) {
    const [settings, setSettings] = useState(null);
    const [error, setError] = useState("");
    const reload = useCallback(() => {
        api("/channel-settings", { channel }).then(setSettings).catch((e) => setError(e.message));
    }, [channel]);
    useEffect(reload, [reload]);
    const patch = useCallback(async (updates) => {
        try {
            await api("/channel-settings", { method: "PUT", channel, body: updates });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }, [channel, reload]);
    return { settings, patch, error, setError };
}

/** Zahlen-Einstellung: wird beim Verlassen des Felds bzw. mit Enter gespeichert (nicht bei jedem Tastendruck). */
export function NumberSetting({ label, hint, field, onChange, onReset }) {
    const [text, setText] = useState(String(field.value));
    useEffect(() => setText(String(field.value)), [field.value]);
    function commit() {
        const n = Number(text);
        if (text.trim() === "" || !Number.isFinite(n)) return setText(String(field.value)); // ungültig: alten Wert zurück
        if (n !== field.value) onChange(n);
    }
    return (
        <label className="setting">
            {label}
            <input type="number" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
            {!field.isDefault && <button type="button" onClick={onReset}>Standard</button>}
            {hint && <span className="hint">{hint}</span>}
        </label>
    );
}

export function BoolSetting({ label, field, onChange, onReset }) {
    return (
        <label className="setting">
            <input type="checkbox" checked={field.value} onChange={(e) => onChange(e.target.checked)} /> {label}
            {!field.isDefault && <button type="button" onClick={onReset}>Standard</button>}
        </label>
    );
}

/** Ein/Aus-Einstellung als "Status: an [Ausschalten]" (statt Checkbox) - ändert den Wert sofort mit dem Knopf. */
export function StatusToggle({ label, field, onChange }) {
    const on = !!field.value;
    return (
        <div className="status-toggle">
            {label && <span className="hint">{label}</span>}
            <p>
                Status: <strong>{on ? "an" : "aus"}</strong>{" "}
                <button type="button" onClick={() => onChange(!on)}>{on ? "Ausschalten" : "Einschalten"}</button>
            </p>
        </div>
    );
}

/** Dezimalzahl-Einstellung (z. B. 1,345): wird wie die Zahlenfelder beim Verlassen des Felds bzw. mit Enter gespeichert. */
export function DecimalSetting({ label, hint, field, onChange, onReset }) {
    const [text, setText] = useState(String(field.value));
    useEffect(() => setText(String(field.value)), [field.value]);
    function commit() {
        const n = Number(text.replace(",", "."));
        if (text.trim() === "" || !Number.isFinite(n)) return setText(String(field.value));
        if (n !== field.value) onChange(n);
    }
    return (
        <div className="setting">
            <label>{label} <input type="text" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} style={{ width: "6rem" }} /></label>
            {!field.isDefault && <button type="button" onClick={onReset}>Standard</button>}
            {hint && <span className="hint">{hint}</span>}
        </div>
    );
}

/** Listen-Einstellung: das Feld ist gesperrt, bis man auf "Bearbeiten" klickt (verhindert versehentliche Änderungen). */
export function ListSetting({ label, hint, field, onChange, onReset }) {
    const [text, setText] = useState(field.value.join("\n"));
    const [editing, setEditing] = useState(false);
    useEffect(() => { if (!editing) setText(field.value.join("\n")); }, [field.value, editing]);
    const save = async () => {
        await onChange(text.split("\n").map((l) => l.trim()).filter(Boolean));
        setEditing(false);
    };
    const cancel = () => { setText(field.value.join("\n")); setEditing(false); };
    const reset = async () => {
        await onReset();
        setEditing(false);
    };
    return (
        <div className="setting setting-list">
            <span>{label}{field.isDefault && <span className="hint"> – aktuell: Standardliste aus der Datei</span>}</span>
            {hint && <p className="hint">{hint}</p>}
            <textarea rows={Math.min(10, Math.max(3, field.value.length + 1))} value={text} readOnly={!editing}
                onChange={(e) => setText(e.target.value)}
                style={editing ? undefined : { opacity: 0.7, cursor: "default" }} />
            <div className="row">
                {editing ? (
                    <>
                        <button type="button" onClick={save}>Speichern</button>
                        <button type="button" onClick={cancel}>Abbrechen</button>
                        {!field.isDefault && <button type="button" onClick={reset}>Standardliste verwenden</button>}
                    </>
                ) : (
                    <button type="button" onClick={() => setEditing(true)}>Bearbeiten</button>
                )}
            </div>
        </div>
    );
}

/** Einklappbarer Bereich mit Pfeil im Titel (für Einstellungs-Panels). */
export function Collapsible({ title, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="collapsible">
            <button type="button" className="collapsible-toggle" onClick={() => setOpen((o) => !o)}>
                <span className={`collapsible-arrow ${open ? "open" : ""}`}>▶</span> {title}
            </button>
            {open && <div className="collapsible-body">{children}</div>}
        </div>
    );
}

/** Erklärtext: am PC normal sichtbar, auf dem Handy hinter einem einklappbaren "Erklärung"-Titel (standardmäßig zu). */
export function MobileHint({ title = "Erklärung", children }) {
    const isMobile = useIsMobile();
    if (!isMobile) return <>{children}</>;
    return <Collapsible title={title}>{children}</Collapsible>;
}

/** Hilfs-Hook: lädt eine Liste und bietet reload() */
export function useList(path, channel) {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");
    const reload = useCallback(() => {
        api(path, { channel }).then(setRows).catch((e) => setError(e.message));
    }, [path, channel]);
    useEffect(reload, [reload]);
    return { rows, reload, error, setError };
}

export const Card = ({ label, value }) => (
    <div className="card"><strong>{value}</strong><span>{label}</span></div>
);

/** Name links, daneben EIN langes Kästchen mit mehreren Werten nebeneinander (statt pro Wert ein eigenes Kästchen). */
export const StatRow = ({ label, items }) => (
    <div className="stat-row">
        <span className="stat-row-label">{label}</span>
        <div className="stat-row-box">
            {items.map((it) => (
                <div key={it.label} className="stat-row-item">
                    <strong>{it.value}</strong>
                    <span>{it.label}</span>
                </div>
            ))}
        </div>
    </div>
);

/** Kleinbuchstaben-Vergleich: alle Suchwörter müssen in mindestens einem der Felder vorkommen. */
export function matchesQuery(query, ...fields) {
    const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = fields.map((f) => String(f ?? "").toLowerCase()).join(" ");
    return words.every((w) => hay.includes(w));
}

/**
 * Suchleiste über einer Liste: Suchfeld, optionale Auswahlfelder (children), Trefferzähler und "×" zum Zurücksetzen.
 * active = true, sobald irgendein Filter gesetzt ist (Suchtext oder Auswahl).
 */
export function FilterBar({ query, setQuery, shown, total, active, onClear, placeholder = "Suchen ...", children }) {
    return (
        <div className="filter-bar">
            <input type="search" className="grow" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            {children}
            {active && (
                <>
                    <span className={"hint" + (shown === 0 ? " warn" : "")}>{shown === 0 ? "Keine Treffer" : `${shown} von ${total}`}</span>
                    <button type="button" title="Filter zurücksetzen" onClick={onClear}>×</button>
                </>
            )}
        </div>
    );
}

/** true auf schmalen Bildschirmen (Handy hochkant) - folgt Änderungen live, z. B. beim Drehen. */
export function useIsMobile(maxWidth = 700) {
    const query = `(max-width: ${maxWidth}px)`;
    const [mobile, setMobile] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
    useEffect(() => {
        if (!window.matchMedia) return undefined;
        const mq = window.matchMedia(query);
        const onChange = (e) => setMobile(e.matches);
        setMobile(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [query]);
    return mobile;
}

/**
 * Handy-Ansicht für Tabellen: jede Zeile als einklappbare Karte (Titel + Kurzinfo + Vorschau sichtbar,
 * Details und Schaltflächen erst nach dem Aufklappen). Es ist immer nur eine Karte offen.
 */
export function CardList({ rows, rowKey, title, meta, preview, details, actions }) {
    const [openKey, setOpenKey] = useState(null);
    return (
        <div className="cmd-list">
            {rows.map((r) => {
                const key = rowKey(r);
                const open = openKey === key;
                const toggle = () => setOpenKey(open ? null : key);
                return (
                    <div key={key} className={"cmd-card" + (open ? " open" : "")}>
                        <div className="cmd-card-head" onClick={toggle}>
                            <span className={"collapsible-arrow" + (open ? " open" : "")}>▶</span>
                            <strong>{title(r)}</strong>
                            {meta && <span className="cmd-meta">{meta(r)}</span>}
                        </div>
                        {preview && <p className="cmd-response" onClick={toggle}>{preview(r)}</p>}
                        {open && (
                            <>
                                {details && <div className="cmd-details">{details(r)}</div>}
                                {actions && <div className="cmd-actions">{actions(r)}</div>}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
