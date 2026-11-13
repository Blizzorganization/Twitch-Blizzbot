import { useState } from "react";
import { api } from "../api";
import { useList, useChannelSettings, StatusToggle, MobileHint } from "../components/common.jsx";

/** Moderation → Verify-Mods: zusätzliche Nutzer, die die Mod-Commands des Bots nutzen dürfen (nur Admins). */
export function BotMods({ channel }) {
    const { rows, reload, error, setError } = useList("/bot-mods", channel);
    const [name, setName] = useState("");
    const { settings, patch } = useChannelSettings(channel);

    async function add(e) {
        e.preventDefault();
        setError("");
        try {
            await api("/bot-mods", { method: "POST", channel, body: { username: name }, toast: "Eingetragen" });
            setName("");
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    async function remove(r) {
        if (!confirm(`${r.username} wirklich als Verify-Mod entfernen?`)) return;
        try {
            await api(`/bot-mods/${encodeURIComponent(r.username)}`, { method: "DELETE", channel });
            reload();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <section>
            <h2>Verify-Mods</h2>
            <MobileHint>
                <p className="hint">
                    Ist die Option unten aktiv, gelten <strong>nur die hier eingetragenen Nutzer</strong> als Moderator für den Bot
                    (<code>mods.txt</code> und das Twitch-Mod-Abzeichen werden dann ignoriert; Streamer und Devs bleiben unberührt).
                    Ist sie aus, hat die Liste keine Wirkung. Geht auch per Discord: <code>/addmod</code>, <code>/delmod</code>, <code>/mods</code>.
                </p>
            </MobileHint>
            {settings && (
                <StatusToggle label="Nur Nutzer aus dieser Liste gelten als Moderator" field={settings.botModsOnly}
                    onChange={(v) => patch({ botModsOnly: v })} />
            )}
            <form className="row" onSubmit={add}>
                <input placeholder="Twitch-Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <button type="submit">Hinzufügen</button>
            </form>
            {error && <p className="error">{error}</p>}
            <table>
                <thead><tr><th>Nutzer</th><th>Eingetragen von</th><th></th></tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.username}>
                            <td>{r.username}</td><td>{r.added_by ?? "–"}</td>
                            <td className="actions"><button className="danger" onClick={() => remove(r)}>Entfernen</button></td>
                        </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={3}>Noch niemand eingetragen.</td></tr>}
                </tbody>
            </table>
        </section>
    );
}
