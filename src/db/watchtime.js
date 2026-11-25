import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { logger } from "../utils/logger.js";

/** Monatsschlüssel im Format des alten Bots: "MM-YYYY" (z. B. "09-2026") */
export function currentMonth() {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

let busy = false;

/** +1 Watchtime-Einheit (= 30 s) für alle Zuschauer – Monat und "alltime" (wie db.watchtime im alten Bot). */
export async function addWatchtime(channel, viewers) {
    if (busy || !viewers.length) return;
    busy = true;
    channel = cleanChannel(channel);
    await ensureChannel(channel);
    const client = await pool.connect();
    try {
        const month = currentMonth();
        await client.query("BEGIN");
        for (const m of [month, "alltime"]) {
            await client.query(
                `INSERT INTO watchtime (channel, viewer, watchtime, month)
                 SELECT $1, v, 0, $3 FROM unnest($2::varchar(25)[]) AS v ON CONFLICT DO NOTHING;`,
                [channel, viewers, m],
            );
            await client.query(
                `UPDATE watchtime SET watchtime = watchtime + 1
                 WHERE channel = $1 AND month = $3 AND viewer = ANY($2::varchar(25)[]);`,
                [channel, viewers, m],
            );
        }
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        logger.error("Watchtime-Update fehlgeschlagen:", e.message);
    } finally {
        client.release();
        busy = false;
    }
}

/** @returns {Promise<number|undefined>} Einheiten à 30 s oder undefined, wenn unbekannt */
export async function getWatchtime(channel, viewer, month = "alltime") {
    const { rows } = await pool.query(
        `SELECT watchtime FROM watchtime WHERE viewer = $1 AND channel = $2 AND month = $3;`,
        [viewer.toLowerCase(), cleanChannel(channel), month],
    );
    return rows[0]?.watchtime;
}

export async function renameWatchtimeUser(channel, oldName, newName) {
    await pool.query(`UPDATE watchtime SET viewer = $3 WHERE viewer = $2 AND channel = $1;`, [
        cleanChannel(channel),
        oldName.toLowerCase(),
        newName.toLowerCase(),
    ]);
}

/** month: "alltime", ein Monatsschlüssel "MM-YYYY" oder eine Liste von Monatsschlüsseln (Zeitspanne: Monatswerte werden addiert). */
export async function watchtimeList(channel, month = "alltime", limit = 10, page = 1, search = "") {
    const q = String(search ?? "").trim().toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
    const offset = Math.max(0, page - 1) * limit;
    if (Array.isArray(month)) {
        const { rows } = await pool.query(
            `SELECT viewer, SUM(watchtime)::int AS watchtime FROM watchtime
             WHERE month = ANY($1::text[]) AND channel = $2 AND ($5 = '' OR viewer LIKE '%' || $5 || '%')
             GROUP BY viewer ORDER BY watchtime DESC, viewer LIMIT $3 OFFSET $4;`,
            [month, cleanChannel(channel), limit, offset, q],
        );
        return rows;
    }
    const { rows } = await pool.query(
        `SELECT viewer, watchtime FROM watchtime WHERE month = $1 AND channel = $2 AND ($5 = '' OR viewer LIKE '%' || $5 || '%')
         ORDER BY watchtime DESC, viewer LIMIT $3 OFFSET $4;`,
        [month, cleanChannel(channel), limit, offset, q],
    );
    return rows;
}

/** Monatsschlüssel ("MM-YYYY") von "YYYY-MM" bis "YYYY-MM" (einschließlich); null bei ungültiger Eingabe. */
export function monthKeysBetween(from, to) {
    const ok = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v));
    if (!ok(from) || !ok(to) || from > to) return null;
    const keys = [];
    let [y, m] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    while (y < ty || (y === ty && m <= tm)) {
        keys.push(`${String(m).padStart(2, "0")}-${y}`);
        if (++m > 12) { m = 1; y++; }
        if (keys.length > 120) return null; // höchstens 10 Jahre
    }
    return keys;
}

/** Setzt die Watchtime (Einheiten à 30 s) eines Nutzers für "alltime" oder einen Monatsschlüssel; legt den Eintrag bei Bedarf an. */
export async function setWatchtime(channel, viewer, month, units) {
    channel = cleanChannel(channel);
    viewer = String(viewer).trim().replace(/^@/, "").toLowerCase();
    await ensureChannel(channel);
    const old = (await getWatchtime(channel, viewer, month)) ?? 0;
    await pool.query(
        `INSERT INTO watchtime (channel, viewer, watchtime, month) VALUES ($1, $2, $4, $3)
         ON CONFLICT (channel, viewer, month) DO UPDATE SET watchtime = EXCLUDED.watchtime;`,
        [channel, viewer, month, units],
    );
    return { viewer, old, new: units };
}

/** Platz in der Gesamt-Watchtime (1 = ganz vorn) oder null, wenn der Nutzer keine Watchtime hat. */
export async function getWatchtimeRank(channel, viewer) {
    const { rows } = await pool.query(
        `SELECT COUNT(*) + 1 AS rank FROM watchtime
         WHERE channel = $1 AND month = 'alltime'
           AND watchtime > (SELECT watchtime FROM watchtime WHERE channel = $1 AND month = 'alltime' AND viewer = $2);`,
        [cleanChannel(channel), viewer.toLowerCase()],
    );
    return (await getWatchtime(channel, viewer, "alltime")) === undefined ? null : Number(rows[0].rank);
}
