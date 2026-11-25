/**
 * In-Memory Cooldown pro Kanal+Command (global) und pro Nutzer.
 * Die Dauer kommt pro Command aus der Datenbank (Spalte "cooldown", Sekunden).
 */
const globalCd = new Map(); // "channel:command" -> timestamp (ms)
const userCd = new Map(); // "channel:command:user" -> timestamp (ms)

const USER_COOLDOWN_FACTOR = 2; // Nutzer-Cooldown = 2x globaler Cooldown

/**
 * Prüft den Cooldown und setzt ihn, falls der Command ausgeführt werden darf.
 * @returns {number} 0 wenn erlaubt, sonst verbleibende Sekunden
 */
export function checkCooldown(channel, command, user, seconds, bypass = false) {
    if (bypass || !seconds || seconds <= 0) return 0;
    const now = Date.now();
    const gKey = `${channel}:${command}`;
    const uKey = `${gKey}:${user}`;

    const gLeft = (globalCd.get(gKey) ?? 0) + seconds * 1000 - now;
    if (gLeft > 0) return Math.ceil(gLeft / 1000);

    const uLeft = (userCd.get(uKey) ?? 0) + seconds * USER_COOLDOWN_FACTOR * 1000 - now;
    if (uLeft > 0) return Math.ceil(uLeft / 1000);

    globalCd.set(gKey, now);
    userCd.set(uKey, now);
    return 0;
}

export function resetCooldown(channel, command) {
    globalCd.delete(`${channel}:${command}`);
    for (const k of userCd.keys()) if (k.startsWith(`${channel}:${command}:`)) userCd.delete(k);
}

// Alte Einträge regelmäßig aufräumen (verhindert Speicherwachstum)
setInterval(() => {
    const limit = Date.now() - 10 * 60 * 1000;
    for (const [k, t] of globalCd) if (t < limit) globalCd.delete(k);
    for (const [k, t] of userCd) if (t < limit) userCd.delete(k);
}, 5 * 60 * 1000).unref();
