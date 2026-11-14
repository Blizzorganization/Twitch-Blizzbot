import { useState } from "react";
import { api, getToken, getUsername, getIsAdmin, getIsOwner, getUserId, setSession } from "../api";

export function AccountPanel({ onClose }) {
    const [username, setUsername] = useState(getUsername());
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function save(e) {
        e.preventDefault();
        setError("");
        try {
            const body = { username };
            if (password) body.password = password;
            const user = await api(`/users/${getUserId()}`, { method: "PUT", body });
            setSession(getToken(), user.username, getIsAdmin(), getUserId(), getIsOwner());
            setPassword("");
            setDone(true);
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <form className="panel modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
                <h3>Mein Konto</h3>
                <div className="row">
                    <input placeholder="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    <input type="password" autoComplete="new-password" placeholder="Neues Passwort (leer lassen für unverändert)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
                </div>
                {error && <p className="error">{error}</p>}
                {done && <p className="hint">Gespeichert.</p>}
                <div className="row">
                    <button type="submit">Speichern</button>
                    <button type="button" onClick={onClose}>Schließen</button>
                </div>
            </form>
        </div>
    );
}
