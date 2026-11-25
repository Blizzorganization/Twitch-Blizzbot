import { pool } from "./pool.js";
import { ensureChannel, cleanChannel } from "./init.js";
import { config } from "../config.js";
import { UserError } from "../utils/errors.js";

/**
 * Discord-Einstellungen pro Twitch-Kanal (Tabelle discord_settings). Der Bot-Token und die Client-ID bleiben global
 * in der .env (es ist EIN Discord-Bot); Server, Admin-Rolle, Blacklist-/Say-Kanal und Embed-Farbe stehen pro Kanal hier.
 *
 * Server-Zuordnung:
 *   guild_ids         Server mit den Verwaltungs-Commands (/add, /edit, /del ...) - und, falls public_guild_ids leer ist, auch mit den Nutzer-Commands
 *   public_guild_ids  optional eigene Server für die Nutzer-Commands (/watchtime, /profil ...)
 * Ein Server darf (je Befehlsart) nur zu EINEM Kanal gehören, damit die Zuordnung eindeutig ist.
 */

const DEFAULT_COLOR = 0xedbc5d;
const ID_RE = /^\d{5,25}$/;

let cache = []; // normalisierte Zeilen

const splitIds = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

function normalize(r) {
    const hex = String(r.embed_color ?? "").replace(/^#/, "");
    const n = parseInt(hex, 16);
    return {
        channel: r.channel,
        enabled: r.enabled,
        guildIds: splitIds(r.guild_ids),
        publicGuildIds: splitIds(r.public_guild_ids),
        adminRoleId: r.admin_role_id || "",
        blacklistChannelId: r.blacklist_channel_id || "",
        sayChannelId: r.say_channel_id || "",
        embedColorHex: hex && !Number.isNaN(n) ? `#${hex.toLowerCase()}` : "",
        embedColor: hex && !Number.isNaN(n) ? n : DEFAULT_COLOR,
    };
}

/** Server, auf denen die Nutzer-Commands eines Kanals laufen: eigene Liste, sonst dieselben wie die Verwaltung. */
export const effectivePublicGuildIds = (s) => (s.publicGuildIds.length ? s.publicGuildIds : s.guildIds);

export async function loadDiscordSettings() {
    const { rows } = await pool.query(`SELECT * FROM discord_settings ORDER BY channel;`);
    cache = rows.map(normalize);
    return cache;
}

/** Zwischengespeicherte Einstellungen aller Kanäle (nach loadDiscordSettings). */
export const allDiscordSettings = () => cache;
export const discordSettingsFor = (channel) => cache.find((s) => s.channel === cleanChannel(channel)) ?? null;
/** Nur Kanäle, für die Discord eingeschaltet ist. */
export const activeDiscordSettings = () => cache.filter((s) => s.enabled);

/** Einstellungen des Kanals, zu dem ein Discord-Server gehört. scope: "admin" (Verwaltungs-Commands) oder "public" (Nutzer-Commands). */
export function settingsForGuild(guildId, scope) {
    if (!guildId) return null;
    return activeDiscordSettings().find((s) => (scope === "public" ? effectivePublicGuildIds(s) : s.guildIds).includes(String(guildId))) ?? null;
}
/** Einstellungen, in denen dieser Discord-Kanal als Say-Kanal eingetragen ist. */
export const settingsForSayChannel = (channelId) => (channelId ? activeDiscordSettings().find((s) => s.sayChannelId === String(channelId)) ?? null : null);

function cleanIds(value, label) {
    const ids = splitIds(Array.isArray(value) ? value.join(",") : value);
    for (const id of ids) if (!ID_RE.test(id)) throw new UserError(`${label}: "${id}" ist keine gültige Discord-ID (nur Ziffern).`);
    return [...new Set(ids)];
}
function cleanId(value, label) {
    const v = String(value ?? "").trim();
    if (v && !ID_RE.test(v)) throw new UserError(`${label}: "${v}" ist keine gültige Discord-ID (nur Ziffern).`);
    return v;
}

/** Speichert die Einstellungen eines Kanals (legt sie an oder ersetzt sie). Wirft UserError bei ungültigen/doppelten Angaben. */
export async function saveDiscordSettings(channel, input) {
    channel = cleanChannel(channel);
    const guildIds = cleanIds(input.guildIds, "Server (Verwaltung)");
    const publicGuildIds = cleanIds(input.publicGuildIds, "Server (Nutzer-Commands)");
    const adminRoleId = cleanId(input.adminRoleId, "Admin-Rolle");
    const blacklistChannelId = cleanId(input.blacklistChannelId, "Blacklist-Kanal");
    const sayChannelId = cleanId(input.sayChannelId, "Say-Kanal");
    let color = String(input.embedColor ?? "").trim().replace(/^#/, "");
    if (color && !/^[0-9a-fA-F]{6}$/.test(color)) throw new UserError("Embed-Farbe: bitte als Hex-Wert wie #edbc5d angeben.");
    const enabled = input.enabled !== false;

    // Eindeutigkeit: ein Server gehört (je Befehlsart) zu genau einem anderen Kanal
    const mine = { channel, guildIds, publicGuildIds };
    for (const other of cache.filter((s) => s.channel !== channel)) {
        const dupAdmin = guildIds.find((g) => other.guildIds.includes(g));
        if (dupAdmin) throw new UserError(`Der Server ${dupAdmin} gehört schon zu Kanal "${other.channel}" (Verwaltung).`);
        const dupPublic = effectivePublicGuildIds(mine).find((g) => effectivePublicGuildIds(other).includes(g));
        if (dupPublic) throw new UserError(`Der Server ${dupPublic} ist schon für die Nutzer-Commands von Kanal "${other.channel}" eingetragen.`);
        if (sayChannelId && other.sayChannelId === sayChannelId) throw new UserError(`Der Say-Kanal ist schon für "${other.channel}" eingetragen.`);
    }

    await ensureChannel(channel);
    await pool.query(
        `INSERT INTO discord_settings (channel, enabled, guild_ids, public_guild_ids, admin_role_id, blacklist_channel_id, say_channel_id, embed_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (channel) DO UPDATE SET enabled = EXCLUDED.enabled, guild_ids = EXCLUDED.guild_ids,
            public_guild_ids = EXCLUDED.public_guild_ids, admin_role_id = EXCLUDED.admin_role_id,
            blacklist_channel_id = EXCLUDED.blacklist_channel_id, say_channel_id = EXCLUDED.say_channel_id,
            embed_color = EXCLUDED.embed_color;`,
        [channel, enabled, guildIds.join(","), publicGuildIds.join(","), adminRoleId || null, blacklistChannelId || null, sayChannelId || null, color ? `#${color.toLowerCase()}` : null],
    );
    await loadDiscordSettings();
    return discordSettingsFor(channel);
}

export async function deleteDiscordSettings(channel) {
    const { rowCount } = await pool.query(`DELETE FROM discord_settings WHERE channel = $1;`, [cleanChannel(channel)]);
    await loadDiscordSettings();
    return rowCount > 0;
}

/**
 * Übernimmt die bisherigen .env-Werte (DISCORD_GUILD_ID, DISCORD_PUBLIC_GUILD_ID, DISCORD_ADMIN_ROLE_ID,
 * DISCORD_BLACKLIST_CHANNEL_ID, DISCORD_SAY_CHANNEL_ID, DISCORD_EMBED_COLOR) einmalig als Einstellung des
 * bisherigen Kanals - aber nur, solange die Tabelle noch leer ist.
 */
export async function seedDiscordSettingsFromEnv() {
    const d = config.discord;
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM discord_settings;`);
    if (rows[0].n > 0 || !d.twitchChannel || !d.guildIds.length) return false;
    const sayChannel = d.sayTwitchChannel === d.twitchChannel ? d.sayChannelId : "";
    await saveDiscordSettings(d.twitchChannel, {
        guildIds: d.guildIds,
        publicGuildIds: d.publicGuildIds,
        adminRoleId: d.adminRoleId,
        blacklistChannelId: d.blacklistChannelId,
        sayChannelId: sayChannel,
        embedColor: process.env.DISCORD_EMBED_COLOR ?? "",
        enabled: true,
    });
    return true;
}
