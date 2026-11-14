import { useState, useEffect } from "react";
import { authStatus, setSession, login as apiLogin, setup as apiSetup } from "./api";

export function Login({ onLogin, error: initialError }) {
    const [hasUsers, setHasUsers] = useState(null);
    const [setupNeedsToken, setSetupNeedsToken] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [useToken, setUseToken] = useState(false);
    const [tokenValue, setTokenValue] = useState("");
    const [error, setError] = useState(initialError ?? "");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        authStatus()
            .then((s) => { setHasUsers(s.hasUsers); setSetupNeedsToken(!!s.setupNeedsToken); })
            .catch((e) => setError(e.message));
    }, []);

    async function submit(e) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            if (useToken) {
                setSession(tokenValue, "Admin-Token", true, 0, true);
            } else if (hasUsers) {
                const r = await apiLogin(username, password);
                setSession(r.token, r.username, r.isAdmin, r.id, r.isOwner);
            } else {
                const r = await apiSetup(username, password, tokenValue);
                setSession(r.token, r.username, r.isAdmin, r.id, r.isOwner);
            }
            onLogin();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (hasUsers === null) return <p className="center">Lade ...</p>;

    return (
        <form className="login" onSubmit={submit}>
            <h1>Blizzbot</h1>
            {useToken ? (
                <input type="password" autoComplete="off" placeholder="Admin-Token" value={tokenValue} onChange={(e) => setTokenValue(e.target.value)} autoFocus />
            ) : (
                <>
                    {!hasUsers && <p className="hint">Noch kein Benutzer vorhanden – lege den ersten an.</p>}
                    <input placeholder="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                    <input type="password" autoComplete="current-password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
                    {!hasUsers && setupNeedsToken && (
                        <input type="password" autoComplete="off" placeholder="Admin-Token (WEB_ADMIN_TOKEN aus der .env)" value={tokenValue} onChange={(e) => setTokenValue(e.target.value)} />
                    )}
                </>
            )}
            <button type="submit" disabled={busy}>{useToken ? "Anmelden" : hasUsers ? "Anmelden" : "Benutzer anlegen"}</button>
            {hasUsers && (
                <button type="button" className="link" onClick={() => setUseToken((v) => !v)}>
                    {useToken ? "Mit Benutzername/Passwort anmelden" : "Mit Admin-Token anmelden"}
                </button>
            )}
            {error && <p className="error">{error}</p>}
        </form>
    );
}
