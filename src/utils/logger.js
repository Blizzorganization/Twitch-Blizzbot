function ts() {
    return new Date().toISOString();
}

// Die letzten Warnungen/Fehler merken wir uns im Speicher, damit das Dashboard sie in der Status-Übersicht anzeigen kann.
const RECENT_MAX = 30;
const recent = [];
function remember(level, args) {
    const text = args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    recent.push({ time: ts(), level, text: text.slice(0, 400) });
    if (recent.length > RECENT_MAX) recent.shift();
}

export const logger = {
    info: (...args) => console.log(`[${ts()}] [INFO]`, ...args),
    warn: (...args) => {
        remember("warn", args);
        console.warn(`[${ts()}] [WARN]`, ...args);
    },
    error: (...args) => {
        remember("error", args);
        console.error(`[${ts()}] [ERROR]`, ...args);
    },
    /** Positive Meldung für die Fehlerliste im Dashboard (z. B. "wieder verbunden"); steht dort zusammen mit den Warnungen. */
    ok: (...args) => {
        remember("ok", args);
        console.log(`[${ts()}] [OK]`, ...args);
    },
    debug: (...args) => {
        if (process.env.DEBUG === "true") console.debug(`[${ts()}] [DEBUG]`, ...args);
    },
    // Start-Diagnose (Web-URL, Moderator-Erfassung, EventSub-Sessions): nur mit DIAGNOSE=true in configs/.env
    diag: (...args) => {
        if (process.env.DIAGNOSE === "true") console.log(`[${ts()}] [DIAGNOSE]`, ...args);
    },
    /** Die zuletzt aufgetretenen Warnungen/Fehler (neueste zuerst). */
    recent: (limit = 10) => recent.slice(-limit).reverse(),
};
