import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

/**
 * Alert-Typen mit Standardtext (wie bisher fest im Code) und den Platzhaltern,
 * die für diesen Typ zur Verfügung stehen.
 */
export const ALERT_TYPES = {
    sub: {
        label: "Neuer Sub",
        placeholders: ["user", "tier"],
        default: "🎉 {user} hat einen {tier}-Sub abgeschlossen! Willkommen in der Community! 💜",
        sample: { user: "Beispielnutzer", tier: "Tier 1" },
    },
    resub: {
        label: "Resub",
        // {message} = Nachricht des Abonnenten (leer, wenn keine dabei ist); {withMessage} = " Mit der Nachricht: ..." bzw. nichts
        placeholders: ["user", "months", "tier", "message", "withMessage"],
        default: "💜 {user} ist seit {months} Monaten dabei ({tier}) – danke für deinen Support!{withMessage}",
        sample: { user: "Beispielnutzer", months: 12, tier: "Tier 1", message: "Danke für die tolle Community!", withMessage: " Mit der Nachricht: Danke für die tolle Community!" },
    },
    hypetrain: {
        label: "Hype Train (Zusammenfassung am Ende)",
        // {top} = die größten Unterstützer mit ihren Beiträgen; braucht den Scope channel:read:hype_train
        placeholders: ["level", "total", "top"],
        default: "🚂 Der Hype Train ist zu Ende! Level {level} mit {total} Punkten. Top-Unterstützer: {top} 💜",
        sample: { level: 5, total: "12.400", top: "Anna (4.200), Ben (3.100), Chris (1.900)" },
    },
    cheer: {
        label: "Bits",
        placeholders: ["user", "bits"],
        default: "✨ {user} haut {bits} Bits raus – vielen Dank!",
        sample: { user: "Beispielnutzer", bits: 100 },
    },
    raid: {
        label: "Raid",
        placeholders: ["user", "viewers"],
        default: "⚔️ {user} raidet mit {viewers} Zuschauern! Willkommen alle zusammen!",
        sample: { user: "Beispielkanal", viewers: 25 },
    },
    gift: {
        label: "Einzelner Gift-Sub",
        placeholders: ["user", "recipient", "total", "tier"],
        default: "🎁 {user} schenkt {recipient} einen {tier}-Sub! (Verschenkte Subs im Kanal: {total})",
        sample: { user: "Beispielnutzer", recipient: "Empfänger", total: 5, tier: "Tier 1" },
    },
    massgift: {
        label: "Community-Gift (mehrere Subs)",
        placeholders: ["user", "count", "total", "senderTotal"],
        default: "🎁 {user} haut {count} Sub/s für die Community raus und hat damit schon {senderTotal} Sub/s verschenkt. (Im Kanal verschenkt: {total}) 💜",
        sample: { user: "Beispielnutzer", count: 5, total: 20, senderTotal: 20 },
    },
    giftupgrade: {
        label: "Verlängerter Gift-Sub",
        placeholders: ["user"],
        default: "{user} hat seinen geschenkten Sub verlängert!",
        sample: { user: "Beispielnutzer" },
    },
    primeupgrade: {
        label: "Prime-Upgrade",
        placeholders: ["user"],
        default: "{user} hat von Prime auf einen bezahlten Sub gewechselt!",
        sample: { user: "Beispielnutzer" },
    },
    follow: {
        label: "Follow",
        placeholders: ["user"],
        default: "💜 {user} folgt jetzt dem Kanal. Willkommen!",
        sample: { user: "Beispielnutzer" },
    },
    levelup: {
        label: "Level-Up",
        placeholders: ["user", "level"],
        default: "🆙 {user} ist jetzt Level {level}!",
        sample: { user: "Beispielnutzer", level: 5 },
    },
};

/** Ersetzt {platzhalter} im Template durch die Werte aus context. */
export function formatAlert(template, context) {
    return template.replace(/\{(\w+)\}/g, (m, key) => (key in context ? String(context[key]) : m));
}

/** Alle Alert-Typen mit ihrem aktuellen Text (eigener oder Standard) für einen Kanal. */
export async function listAlertTemplates(channel) {
    const { rows } = await pool.query(`SELECT event_type, template, enabled, as_action FROM alert_messages WHERE channel = $1;`, [
        cleanChannel(channel),
    ]);
    const custom = Object.fromEntries(rows.map((r) => [r.event_type, r]));
    return Object.entries(ALERT_TYPES).map(([type, def]) => ({
        type,
        label: def.label,
        placeholders: def.placeholders,
        default: def.default,
        template: custom[type]?.template ?? def.default,
        isCustom: !!custom[type]?.template,
        enabled: custom[type]?.enabled ?? true,
        asAction: custom[type]?.as_action ?? false,
    }));
}

/** Der aktuell aktive Text eines einzelnen Alert-Typs (eigener oder Standard). */
export async function getAlertTemplate(channel, type) {
    const { rows } = await pool.query(`SELECT template FROM alert_messages WHERE channel = $1 AND event_type = $2;`, [
        cleanChannel(channel),
        type,
    ]);
    return rows[0]?.template ?? ALERT_TYPES[type]?.default ?? "";
}

export async function getAlertEnabled(channel, type) {
    const { rows } = await pool.query(`SELECT enabled FROM alert_messages WHERE channel = $1 AND event_type = $2;`, [
        cleanChannel(channel),
        type,
    ]);
    return rows[0]?.enabled ?? true;
}

/** Ob dieser Alert als /me (kursiv/farbig) gesendet wird. Standard: nein, normale Chatnachricht. */
export async function getAlertAsAction(channel, type) {
    const { rows } = await pool.query(`SELECT as_action FROM alert_messages WHERE channel = $1 AND event_type = $2;`, [
        cleanChannel(channel),
        type,
    ]);
    return rows[0]?.as_action ?? false;
}

export async function setAlertAsAction(channel, type, asAction) {
    if (!(type in ALERT_TYPES)) throw new Error(`Unbekannter Alert-Typ: ${type}`);
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO alert_messages (channel, event_type, as_action) VALUES ($1, $2, $3)
         ON CONFLICT (channel, event_type) DO UPDATE SET as_action = EXCLUDED.as_action;`,
        [cleanChannel(channel), type, asAction],
    );
}

export async function setAlertTemplate(channel, type, template) {
    if (!(type in ALERT_TYPES)) throw new Error(`Unbekannter Alert-Typ: ${type}`);
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO alert_messages (channel, event_type, template) VALUES ($1, $2, $3)
         ON CONFLICT (channel, event_type) DO UPDATE SET template = EXCLUDED.template;`,
        [cleanChannel(channel), type, template],
    );
}

/** Setzt den Text eines Alert-Typs wieder auf den Standard zurück (behält den enabled-Status). */
export async function resetAlertTemplate(channel, type) {
    await pool.query(`UPDATE alert_messages SET template = NULL WHERE channel = $1 AND event_type = $2;`, [
        cleanChannel(channel),
        type,
    ]);
}

/** Schaltet einen Alert-Typ pro Kanal ein/aus (behält einen eventuell eigenen Text). */
export async function setAlertEnabled(channel, type, enabled) {
    if (!(type in ALERT_TYPES)) throw new Error(`Unbekannter Alert-Typ: ${type}`);
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO alert_messages (channel, event_type, enabled) VALUES ($1, $2, $3)
         ON CONFLICT (channel, event_type) DO UPDATE SET enabled = EXCLUDED.enabled;`,
        [cleanChannel(channel), type, enabled],
    );
}
