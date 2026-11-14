import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";

/**
 * Bearbeitbare Texte für die Phasen eines Giveaways, mit Standardtext und den
 * Platzhaltern, die für die jeweilige Phase zur Verfügung stehen.
 */
export const GIVEAWAY_TYPES = {
    start: {
        label: "Giveaway-Start",
        placeholders: ["title", "keyword"],
        default: '🎁 Giveaway gestartet: "{title}" – schreibe {keyword} in den Chat, um teilzunehmen!',
        sample: { title: "Beispiel-Giveaway", keyword: "!gewinnen" },
    },
    repeat: {
        label: "Erinnerung (während das Giveaway läuft)",
        placeholders: ["title", "keyword"],
        default: '🎁 Das Giveaway "{title}" läuft noch – schreibe {keyword} in den Chat, um teilzunehmen!',
        sample: { title: "Beispiel-Giveaway", keyword: "!gewinnen" },
    },
    join: {
        label: "Teilnahme bestätigt",
        placeholders: ["user", "title"],
        default: "✅ {user} nimmt am Giveaway \"{title}\" teil!",
        sample: { user: "Beispielnutzer", title: "Beispiel-Giveaway" },
    },
    end: {
        label: "Teilnahme beendet (ohne Ziehung)",
        placeholders: ["title"],
        default: 'Die Teilnahme am Giveaway "{title}" ist beendet.',
        sample: { title: "Beispiel-Giveaway" },
    },
    draw: {
        label: "Ziehung / Gewinner",
        placeholders: ["title", "winners"],
        default: '🎉 Das Giveaway "{title}" ist vorbei! Gewinner: {winners} 🎉',
        sample: { title: "Beispiel-Giveaway", winners: "Beispielnutzer1, Beispielnutzer2" },
    },
};

/** Separater Text, falls bei der Ziehung niemand teilgenommen hat (kein eigener Platzhalter-Typ, da selten gebraucht). */
export const GIVEAWAY_DRAW_EMPTY_DEFAULT = 'Das Giveaway "{title}" ist vorbei, aber es gab leider keine Teilnehmer.';

/** Ersetzt {platzhalter} im Template durch die Werte aus context. */
export function formatGiveawayTemplate(template, context) {
    return template.replace(/\{(\w+)\}/g, (m, key) => (key in context ? String(context[key]) : m));
}

/** Alle Giveaway-Text-Typen mit ihrem aktuellen Text (eigener oder Standard) für einen Kanal. */
export async function listGiveawayTemplates(channel) {
    const { rows } = await pool.query(`SELECT event_type, template FROM giveaway_messages WHERE channel = $1;`, [
        cleanChannel(channel),
    ]);
    const custom = Object.fromEntries(rows.map((r) => [r.event_type, r.template]));
    return Object.entries(GIVEAWAY_TYPES).map(([type, def]) => ({
        type,
        label: def.label,
        placeholders: def.placeholders,
        default: def.default,
        template: custom[type] ?? def.default,
        isCustom: !!custom[type],
    }));
}

/** Der aktuell aktive Text eines einzelnen Giveaway-Typs (eigener oder Standard). */
export async function getGiveawayTemplate(channel, type) {
    const { rows } = await pool.query(`SELECT template FROM giveaway_messages WHERE channel = $1 AND event_type = $2;`, [
        cleanChannel(channel),
        type,
    ]);
    return rows[0]?.template ?? GIVEAWAY_TYPES[type]?.default ?? "";
}

export async function setGiveawayTemplate(channel, type, template) {
    if (!(type in GIVEAWAY_TYPES)) throw new Error(`Unbekannter Giveaway-Text-Typ: ${type}`);
    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO giveaway_messages (channel, event_type, template) VALUES ($1, $2, $3)
         ON CONFLICT (channel, event_type) DO UPDATE SET template = EXCLUDED.template;`,
        [cleanChannel(channel), type, template],
    );
}

/** Setzt den Text eines Giveaway-Typs wieder auf den Standard zurück. */
export async function resetGiveawayTemplate(channel, type) {
    await pool.query(`UPDATE giveaway_messages SET template = NULL WHERE channel = $1 AND event_type = $2;`, [
        cleanChannel(channel),
        type,
    ]);
}
