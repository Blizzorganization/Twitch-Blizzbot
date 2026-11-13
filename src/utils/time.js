const UNITS = [
    ["Jahr", "Jahren", 365 * 24 * 3600],
    ["Monat", "Monaten", 30 * 24 * 3600],
    ["Tag", "Tagen", 24 * 3600],
    ["Stunde", "Stunden", 3600],
    ["Minute", "Minuten", 60],
    ["Sekunde", "Sekunden", 1],
];

/**
 * Dauer seit einem Zeitpunkt auf Deutsch, z. B. "2 Jahren, 3 Monaten, 5 Tagen"
 * (Dativ, passend zu "vor ..." / "seit ..." wie beim alten Bot).
 */
export function formatSince(date, now = Date.now()) {
    let seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
    const parts = [];
    for (const [singular, plural, size] of UNITS) {
        const n = Math.floor(seconds / size);
        if (n > 0) {
            parts.push(`${n} ${n === 1 ? singular : plural}`);
            seconds -= n * size;
        }
        if (parts.length === 3) break;
    }
    return parts.length ? parts.join(", ") : "0 Sekunden";
}

/** Watchtime-Einheiten (eine Einheit = 30 s) wie calcWatchtime im alten Bot */
export function calcWatchtime(units) {
    const totalMinutes = Math.floor(units / 2);
    const minutes = totalMinutes % 60;
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const days = Math.floor(totalMinutes / 1440);
    return `${days} Tag(en), ${hours} Stunde(n) und ${minutes} Minute(n)`;
}
