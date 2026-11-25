import { useEffect, useState } from "react";
import { api, toast } from "../api";

/** Sicherung: Kanal-Daten als JSON-Datei herunterladen (Export) bzw. aus einer Datei wiederherstellen (Import). */
export function Backup({ channel }) {
    const [sections, setSections] = useState({});
    const [picked, setPicked] = useState([]);
    const [mode, setMode] = useState("merge");
    const [backup, setBackup] = useState(null);
    const [fileName, setFileName] = useState("");
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api("/backup/sections", { channel })
            .then((s) => { setSections(s); setPicked(Object.keys(s)); })
            .catch((e) => setError(e.message));
    }, [channel]);

    // Eine neue Datei bzw. geänderte Auswahl macht die alte Vorschau ungültig
    useEffect(() => { setPreview(null); }, [mode, picked, backup, channel]);

    async function doExport() {
        setError("");
        try {
            const data = await api(`/backup/export`, { channel, toast: false });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `blizzbot-${channel}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast("Sicherung heruntergeladen");
        } catch (err) {
            setError(err.message);
        }
    }

    function onFile(e) {
        setError("");
        setBackup(null);
        const file = e.target.files?.[0];
        setFileName(file?.name ?? "");
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                if (parsed?.app !== "blizzbot") throw new Error("Das ist keine Blizzbot-Sicherung.");
                setBackup(parsed);
            } catch (err) {
                setError(err.message.startsWith("Das ist") ? err.message : "Die Datei ist kein gültiges JSON.");
            }
        };
        reader.readAsText(file);
    }

    async function run(dryRun) {
        setError("");
        setBusy(true);
        try {
            const out = await api("/backup/import", {
                method: "POST", channel, toast: false,
                body: { backup, mode, sections: picked, dryRun },
            });
            if (dryRun) setPreview(out.result);
            else {
                setPreview(null);
                setBackup(null);
                setFileName("");
                toast("Import abgeschlossen");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    function confirmImport() {
        const msg = mode === "replace"
            ? `Achtung: Die gewählten Bereiche von "${channel}" werden zuerst GELEERT und dann aus der Datei gefüllt. Wirklich fortfahren?`
            : `Fehlende Einträge in "${channel}" werden aus der Datei ergänzt. Fortfahren?`;
        if (confirm(msg)) run(false);
    }

    const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
    const labelOf = (key) => (key === "aliases" ? "Aliase" : sections[key] ?? key);

    return (
        <section>
            <h2>Sicherung</h2>
            <p className="hint">
                Exportiert werden Commands, Aliase, Counter, Blacklist, Automessages, Zitate, Alert-Texte, Begrüßungen, die Verify-Mods-Liste und die Kanal-Einstellungen von
                <strong> {channel}</strong>. Nicht enthalten: Twitch-Zugänge, Dashboard-Benutzer, XP/Punkte/Watchtime der Zuschauer und der Verlauf.
            </p>

            <div className="panel">
                <h3>Export</h3>
                <button onClick={doExport}>Sicherung herunterladen</button>
            </div>

            <div className="panel">
                <h3>Import</h3>
                <input type="file" accept="application/json,.json" onChange={onFile} />
                {fileName && backup && (
                    <p className="hint">
                        {fileName} – Kanal in der Datei: <strong>{backup.channel}</strong>, erstellt am {new Date(backup.exportedAt).toLocaleString("de-DE")}
                    </p>
                )}
                {backup && (
                    <>
                        <div className="setting-sub">
                            <strong>Bereiche</strong>
                            {Object.keys(sections).map((key) => (
                                <label key={key} className="check">
                                    <input type="checkbox" checked={picked.includes(key)} onChange={() => toggle(key)} /> {sections[key]}
                                </label>
                            ))}
                        </div>
                        <div className="setting-sub">
                            <strong>Modus</strong>
                            <label className="check">
                                <input type="radio" name="mode" checked={mode === "merge"} onChange={() => setMode("merge")} />
                                Zusammenführen – vorhandene Einträge bleiben, fehlende werden ergänzt
                            </label>
                            <label className="check">
                                <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
                                Ersetzen – gewählte Bereiche werden erst geleert, dann aus der Datei gefüllt
                            </label>
                        </div>
                        <div className="row">
                            <button disabled={busy || !picked.length} onClick={() => run(true)}>Vorschau</button>
                            <button className={mode === "replace" ? "danger" : ""} disabled={busy || !picked.length || !preview} onClick={confirmImport}>
                                Importieren
                            </button>
                        </div>
                        {preview && (
                            <table>
                                <thead><tr><th>Bereich</th><th>Neu</th><th>Übersprungen</th><th>Ungültig</th></tr></thead>
                                <tbody>
                                    {Object.entries(preview).map(([key, r]) => (
                                        <tr key={key}><td>{labelOf(key)}</td><td>{r.added}</td><td>{r.skipped}</td><td>{r.invalid}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>
            {error && <p className="error">{error}</p>}
        </section>
    );
}
