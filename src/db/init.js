import { createHash } from "node:crypto";
import { pool } from "./pool.js";
import { logger } from "../utils/logger.js";

/**
 * Schema des alten Twitch-Blizzbot (modules/db.js) – unverändert übernommen.
 * Eine bestehende alte Datenbank kann daher direkt weiterverwendet werden.
 */
const OLD_SCHEMA = [
    [
        "streamer",
        `CREATE TABLE IF NOT EXISTS streamer (
            name VARCHAR(25) PRIMARY KEY,
            automessage BOOLEAN DEFAULT TRUE
        );`,
    ],
    [
        "watchtime",
        `CREATE TABLE IF NOT EXISTS watchtime (
            channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
            viewer VARCHAR(25) NOT NULL,
            watchtime INTEGER DEFAULT 0,
            month VARCHAR(7) NOT NULL,
            PRIMARY KEY (channel, viewer, month)
        );`,
    ],
    [
        "customcommands",
        `CREATE TABLE IF NOT EXISTS customcommands (
            channel VARCHAR(25) NOT NULL REFERENCES streamer(name),
            command TEXT NOT NULL,
            response TEXT,
            permissions INTEGER,
            PRIMARY KEY (channel, command)
        );`,
    ],
    [
        "aliases",
        `CREATE TABLE IF NOT EXISTS aliases (
            alias TEXT,
            command TEXT NOT NULL,
            channel VARCHAR(25) NOT NULL,
            PRIMARY KEY (channel, alias),
            FOREIGN KEY (channel, command) REFERENCES customcommands(channel, command)
                ON UPDATE CASCADE ON DELETE CASCADE
        );`,
    ],
    [
        "counters",
        `CREATE TABLE IF NOT EXISTS counters (
            channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
            name TEXT,
            cur INTEGER DEFAULT 0,
            inc INTEGER DEFAULT 1,
            PRIMARY KEY (channel, name)
        );`,
    ],
    [
        "userlink",
        `CREATE TABLE IF NOT EXISTS userlink (
            discordid VARCHAR(30) PRIMARY KEY,
            twitchname VARCHAR(25) NOT NULL
        );`,
    ],
    [
        "blacklist",
        `CREATE TABLE IF NOT EXISTS blacklist (
            channel VARCHAR(25) REFERENCES streamer(name) ON DELETE CASCADE ON UPDATE CASCADE,
            blword TEXT,
            action SMALLINT NOT NULL DEFAULT 0,
            UNIQUE (channel, blword)
        );`,
    ],
    [
        "commands",
        `CREATE TABLE IF NOT EXISTS commands (
            channel VARCHAR(25) REFERENCES streamer(name) ON DELETE CASCADE ON UPDATE CASCADE,
            permission INT NOT NULL DEFAULT 0,
            command TEXT NOT NULL,
            enabled BOOLEAN DEFAULT true,
            UNIQUE (channel, command)
        );`,
    ],
];

/**
 * Neue Funktionen – nur additiv, das alte Schema bleibt kompatibel:
 *  - customcommands.cooldown / uses      (Cooldown-Mechanismus, Nutzungszähler)
 *  - streamer.total_subs                 (verschenkte Subs der Community)
 *  - event_log                           (Logging für Stats)
 *  - automessages                        (Automessage-Texte, früher configs/automessages.json)
 *  - giveaways, giveaway_entries          (Giveaways aus dem Dashboard)
 *  - polls, poll_votes                   (Umfragen aus dem Dashboard)
 *  - channel_settings                   (Cooldown, Raid, Automessage, Link-Filter PRO KANAL)
 *  - alert_messages                     (bearbeitbare Texte für Sub/Resub/Bits/Raid/Gift-Alerts)
 *  - user_channels                      (welche Kanäle ein Dashboard-Benutzer verwalten darf; leer = alle)
 *  - web_users                          (Dashboard-Zugänge inkl. is_admin-Rolle)
 *  - web_users                          (Dashboard-Zugänge mit Benutzername/Passwort)
 *  - twitch_tokens                       (API-Token des Broadcasters für !setgame/!settitle)
 */
const EXTENSIONS = [
    `ALTER TABLE customcommands ADD COLUMN IF NOT EXISTS cooldown INTEGER NOT NULL DEFAULT 5;`,
    `ALTER TABLE customcommands ADD COLUMN IF NOT EXISTS uses INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE customcommands ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;`,
    `ALTER TABLE streamer ADD COLUMN IF NOT EXISTS total_subs INTEGER NOT NULL DEFAULT 0;`,
    // Absicherung für den Fall, dass eine bereits bestehende "watchtime"-Tabelle (z. B. aus einem
    // unterbrochenen Setup) diese Spalte noch nicht hat - "CREATE TABLE IF NOT EXISTS" oben legt sie dann
    // NICHT nachträglich an, weshalb das Watchtime-Update sonst mit "column watchtime does not exist" fehlschlägt.
    `ALTER TABLE watchtime ADD COLUMN IF NOT EXISTS watchtime INTEGER DEFAULT 0;`,
    `CREATE TABLE IF NOT EXISTS event_log (
        id BIGSERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        username VARCHAR(64),
        data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS twitch_tokens (
        channel VARCHAR(25) PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Twitch-User-ID des Broadcasters, dem der hinterlegte Token gehört (wird über die Dashboard-Autorisierung
    // automatisch mitgespeichert) - erlaubt, im Dashboard auf einen Blick zu sehen, ob für einen Mehrkanal-Betrieb
    // wirklich für jeden Kanal ein eigener, zum jeweiligen Broadcaster gehörender Token hinterlegt ist.
    `ALTER TABLE twitch_tokens ADD COLUMN IF NOT EXISTS broadcaster_id VARCHAR(32);`,
    `CREATE TABLE IF NOT EXISTS automessages (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Timer/Erinnerungen (!timer): bleiben über Neustarts erhalten
    `CREATE TABLE IF NOT EXISTS timers (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        text TEXT NOT NULL,
        owner VARCHAR(50),
        ends_at TIMESTAMPTZ NOT NULL
    );`,
    // Link-Freigaben (!permit): Nutzer darf für begrenzte Zeit (oder bis der Stream endet) Links posten
    `CREATE TABLE IF NOT EXISTS link_permits (
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        username VARCHAR(25) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        until_offline BOOLEAN NOT NULL DEFAULT FALSE,
        granted_by VARCHAR(50),
        PRIMARY KEY (channel, username)
    );`,
    `CREATE TABLE IF NOT EXISTS giveaways (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        title TEXT NOT NULL,
        keyword TEXT NOT NULL,
        min_permission INTEGER NOT NULL DEFAULT 0,
        winner_count INTEGER NOT NULL DEFAULT 1,
        auto_draw BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(10) NOT NULL DEFAULT 'open', -- open | closed | drawn
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ends_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        winners TEXT[] NOT NULL DEFAULT '{}'
    );`,
    `CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
        username VARCHAR(25) NOT NULL,
        display_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (giveaway_id, username)
    );`,
    `CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        title TEXT NOT NULL,
        options JSONB NOT NULL,
        mode VARCHAR(10) NOT NULL DEFAULT 'chat', -- chat | twitch
        status VARCHAR(10) NOT NULL DEFAULT 'active', -- active | ended
        twitch_poll_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ends_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        result JSONB
    );`,
    `CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        username VARCHAR(25) NOT NULL,
        choice INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (poll_id, username)
    );`,
    `CREATE TABLE IF NOT EXISTS web_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        role VARCHAR(10),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `ALTER TABLE web_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;`,
    `ALTER TABLE web_users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE web_users ADD COLUMN IF NOT EXISTS role VARCHAR(10);`,
    // Migration: altes is_admin-Flag in die neue Rolle übernehmen (nur wo role noch nicht gesetzt ist)
    `UPDATE web_users SET role = CASE WHEN is_admin THEN 'admin' ELSE 'member' END WHERE role IS NULL;`,
    // Es muss genau einen Haupt-Admin ("owner") geben: existiert noch keiner, wird der älteste Account befördert
    `UPDATE web_users SET role = 'owner' WHERE id = (SELECT id FROM web_users ORDER BY id ASC LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM web_users WHERE role = 'owner');`,
    `ALTER TABLE web_users ALTER COLUMN role SET DEFAULT 'member';`,
    `CREATE TABLE IF NOT EXISTS alert_messages (
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        event_type VARCHAR(20) NOT NULL,
        template TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (channel, event_type)
    );`,
    `ALTER TABLE alert_messages ALTER COLUMN template DROP NOT NULL;`,
    `ALTER TABLE alert_messages ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;`,
    // Alerts werden standardmäßig als normale Chatnachricht gesendet; "as_action" schaltet je Alert /me (kursiv/farbig) zu.
    `ALTER TABLE alert_messages ADD COLUMN IF NOT EXISTS as_action BOOLEAN NOT NULL DEFAULT FALSE;`,
    `CREATE TABLE IF NOT EXISTS channel_settings (
        channel VARCHAR(25) PRIMARY KEY REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        cooldown INTEGER,
        raid_minutes INTEGER,
        raid_min_viewers INTEGER,
        automessage_delay INTEGER,
        automessage_only_live BOOLEAN,
        link_filter BOOLEAN,
        delete_me_messages BOOLEAN,
        allowed_links TEXT[],
        tlds TEXT[]
    );`,
    // Intervall (Minuten) für die "Giveaway läuft gerade"-Erinnerung im Chat, solange ein Giveaway offen ist.
    // NULL = eingebauten Standard verwenden, 0 = aus.
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS giveaway_repeat_minutes INTEGER;`,
    // Nutzer (Twitch-Namen, klein geschrieben), die keine Watchtime/XP/Punkte durch Zuschauen sammeln (z. B. Bots, der Streamer)
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS watchtime_excluded TEXT[];`,
    // Mindest-"Gefolgt"-Zeit (Minuten), mit der !raid den Follower-Modus nach der Raid-Pause wieder aktiviert
    // (vorher fest auf 5 Minuten verdrahtet).
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS follow_mode_minutes INTEGER;`,
    // Bearbeitbare Texte für die Giveaway-Phasen (Start/Erinnerung/Teilnahme/Ende/Ziehung), analog zu alert_messages.
    `CREATE TABLE IF NOT EXISTS giveaway_messages (
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        event_type VARCHAR(20) NOT NULL,
        template TEXT,
        PRIMARY KEY (channel, event_type)
    );`,
    // Optionaler Punkte-Einsatz zur Giveaway-Teilnahme (0 = aus, wie bisher kostenlos).
    `ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS point_cost INTEGER NOT NULL DEFAULT 0;`,
    // Eigene Verlaufs-Tabelle ohne Fremdschlüssel auf giveaways: bleibt erhalten, auch wenn das Giveaway später gelöscht wird.
    `CREATE TABLE IF NOT EXISTS giveaway_history (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        giveaway_id INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        winners TEXT[] NOT NULL DEFAULT '{}',
        entry_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Loyalty-System: eine Zeile pro Kanal+Nutzer, zwei GETRENNTE Zähler
    // (xp bestimmt nur das Level, points ist die separate, ausgebbare Währung).
    `CREATE TABLE IF NOT EXISTS user_leveling (
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        username VARCHAR(25) NOT NULL,
        display_name TEXT,
        xp BIGINT NOT NULL DEFAULT 0,
        points BIGINT NOT NULL DEFAULT 0,
        last_message_xp_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (channel, username)
    );`,
    `CREATE INDEX IF NOT EXISTS user_leveling_xp_idx ON user_leveling (channel, xp DESC);`,
    `CREATE INDEX IF NOT EXISTS user_leveling_points_idx ON user_leveling (channel, points DESC);`,
    // Einstellungen für das Loyalty-System pro Kanal (NULL = eingebauter Standard)
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS leveling_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS watchtime_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS rewards_enabled BOOLEAN;`,
    // Spam-Filter (Großbuchstaben / Emote-Spam), pro Kanal
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS caps_filter BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS caps_min_length INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS caps_max_percent INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS emote_filter BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS emote_max_count INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS repeat_filter BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS repeat_max_count INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS char_spam_filter BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS char_run_max INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS char_symbol_percent INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS points_per_message INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS message_points_cooldown_seconds INTEGER;`,
    `ALTER TABLE user_leveling ADD COLUMN IF NOT EXISTS last_message_points_at TIMESTAMPTZ;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS level_xp_base INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS level_xp_multiplier DOUBLE PRECISION;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS xp_per_message INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS message_xp_cooldown_seconds INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS xp_per_watch_minute INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS points_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS points_per_watch_minute INTEGER;`,
    `CREATE TABLE IF NOT EXISTS user_channels (
        user_id INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
        channel VARCHAR(25) NOT NULL,
        PRIMARY KEY (user_id, channel)
    );`,
    `CREATE INDEX IF NOT EXISTS event_log_channel_idx ON event_log (channel, event_type, created_at);`,
    // Audit-Log: wer hat wann welche Verwaltungsaktion im Dashboard ausgeführt (Commands, Aliase, Counter, Benutzer)
    `CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        actor VARCHAR(64) NOT NULL,
        action VARCHAR(32) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target TEXT,
        channel VARCHAR(25),
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);`,
    // War auf 25 Zeichen begrenzt (ein Kanalname) - bei Kanalrechte-Änderungen stehen hier jetzt mehrere, Komma-getrennt
    `ALTER TABLE audit_log ALTER COLUMN channel TYPE VARCHAR(255);`,
    // Pro Automessage ein eigenes Intervall (Minuten) statt nur des globalen Kanal-Delays; NULL/0 = Standard-Intervall verwenden
    `ALTER TABLE automessages ADD COLUMN IF NOT EXISTS delay_minutes INTEGER;`,
    `ALTER TABLE automessages ADD COLUMN IF NOT EXISTS standalone BOOLEAN NOT NULL DEFAULT false;`,
    // Eigener Token des Bot-Accounts (Moderator), über den Löschen/Timeout/Ban/Follower-Modus laufen (eine Zeile, id = 1).
    `CREATE TABLE IF NOT EXISTS twitch_bot_token (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        user_id VARCHAR(32) NOT NULL,
        login VARCHAR(50),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Merkt sich, wann die Moderator-Statistik zuletzt geleert wurde (höchstens einmal pro Kalendermonat erlaubt).
    `CREATE TABLE IF NOT EXISTS mod_action_resets (
        channel VARCHAR(25) PRIMARY KEY REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        reset_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS automessage_min_viewers INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS automessage_min_chat_messages INTEGER;`,
    // Follow-Alert: ab mehr als follow_alert_max Followern innerhalb von follow_alert_window_seconds kommen keine Meldungen (Follower-Bots, Raids)
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS bot_mods_only BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS blacklist_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS timers_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS greetings_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS auto_raid_enabled BOOLEAN;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS auto_raid_min_viewers INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS follow_alert_max INTEGER;`,
    `ALTER TABLE channel_settings ADD COLUMN IF NOT EXISTS follow_alert_window_seconds INTEGER;`,
    // Verify-Mods (Rechtestufe Moderator im Bot), pro Kanal - ergänzt/ersetzt die Datei configs/mods.txt
    `CREATE TABLE IF NOT EXISTS bot_mods (
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        username VARCHAR(25) NOT NULL,
        added_by VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (channel, username)
    );`,
    // Begrüßung bestimmter Nutzer bei ihrer ersten Nachricht im Stream (last_stream_id = Stream, in dem zuletzt begrüßt wurde)
    `CREATE TABLE IF NOT EXISTS chat_greetings (
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        username VARCHAR(25) NOT NULL,
        message TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_stream_id TEXT,
        PRIMARY KEY (channel, username)
    );`,
    // Zitate (wie !zitat im alten Bot)
    `CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        text TEXT NOT NULL,
        added_by VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Wetten (Twitch-Predictions mit Channel Points)
    `CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        title TEXT NOT NULL,
        outcomes JSONB NOT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'active', -- active | locked | resolved | canceled
        twitch_prediction_id TEXT,
        winning_outcome INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        locks_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ
    );`,
    // Zitat-Nummern jetzt pro Kanal fortlaufend (beim Anlegen wird die kleinste freie Nummer DIESES Kanals
    // vergeben, Lücken durch gelöschte Zitate werden wieder aufgefüllt) statt einer global fortlaufenden ID.
    `ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_pkey;`,
    `ALTER TABLE quotes ALTER COLUMN id DROP DEFAULT;`,
    `DROP SEQUENCE IF EXISTS quotes_id_seq;`,
    `ALTER TABLE quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (channel, id);`,
    // Punkte-Rewards, die über das Dashboard (Tab "Aktionen" -> "Rewards") vom Bot selbst angelegt wurden.
    // Das Protokoll der EINLÖSUNGEN (unten) ist davon unabhängig und erfasst ALLE Rewards eines Kanals,
    // auch manuell im Twitch-Dashboard angelegte - siehe README.
    `CREATE TABLE IF NOT EXISTS channel_rewards (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        twitch_reward_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        cost INTEGER NOT NULL,
        prompt TEXT,
        user_input_required BOOLEAN NOT NULL DEFAULT false,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    // Protokoll der Einlösungen - wird per EventSub (Echtzeit-WebSocket, siehe src/twitch/eventsub.js) gefüllt und
    // erfasst JEDE Reward eines Kanals, nicht nur vom Bot selbst angelegte. Titel/Kosten werden deshalb direkt aus
    // dem Event übernommen, statt über eine lokale Fremdschlüssel-Beziehung auf channel_rewards zu laufen.
    `CREATE TABLE IF NOT EXISTS channel_reward_redemptions (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(25) NOT NULL REFERENCES streamer(name) ON UPDATE CASCADE ON DELETE CASCADE,
        twitch_reward_id TEXT NOT NULL,
        reward_title TEXT NOT NULL,
        reward_cost INTEGER NOT NULL,
        twitch_redemption_id TEXT NOT NULL UNIQUE,
        user_name VARCHAR(64) NOT NULL,
        user_input TEXT,
        fulfilled BOOLEAN NOT NULL DEFAULT false,
        redeemed_at TIMESTAMPTZ NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS channel_reward_redemptions_channel_idx ON channel_reward_redemptions (channel, redeemed_at DESC);`,
    // Migration für Installationen, die die Tabelle schon in der alten Form (Fremdschlüssel auf channel_rewards,
    // ohne Titel/Kosten direkt im Datensatz) angelegt hatten:
    `ALTER TABLE channel_reward_redemptions ADD COLUMN IF NOT EXISTS twitch_reward_id TEXT;`,
    `ALTER TABLE channel_reward_redemptions ADD COLUMN IF NOT EXISTS reward_title TEXT;`,
    `ALTER TABLE channel_reward_redemptions ADD COLUMN IF NOT EXISTS reward_cost INTEGER;`,
    `ALTER TABLE channel_reward_redemptions ADD COLUMN IF NOT EXISTS fulfilled BOOLEAN NOT NULL DEFAULT false;`,
    // reward_id gibt es nur bei Installationen, die die Tabelle schon in der alten Form angelegt hatten -
    // bei einer frischen Installation existiert die Spalte gar nicht erst, daher erst prüfen statt direkt
    // ALTER COLUMN/DROP COLUMN aufzurufen (die sonst mit "Spalte existiert nicht" fehlschlagen würden).
    `DO $$
     BEGIN
         IF EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_name = 'channel_reward_redemptions' AND column_name = 'reward_id'
         ) THEN
             ALTER TABLE channel_reward_redemptions DROP CONSTRAINT IF EXISTS channel_reward_redemptions_reward_id_fkey;
             ALTER TABLE channel_reward_redemptions ALTER COLUMN reward_id DROP NOT NULL;
             ALTER TABLE channel_reward_redemptions DROP COLUMN reward_id;
         END IF;
     END $$;`,
];

/**
 * Legt das Schema an. Alle Befehle sind "IF NOT EXISTS", also gefahrlos wiederholbar - aber ~100 einzelne
 * Befehle nacheinander kosten bei jedem Start Zeit (jeder ist eine Anfrage an die Datenbank, ALTER TABLE
 * braucht zusätzlich eine Sperre). Darum:
 *   1. Ein Fingerabdruck des Schemas steht in der Tabelle schema_meta. Stimmt er überein, ist nichts zu tun.
 *   2. Sonst laufen alle Befehle in EINER Anfrage (ein Netzwerk-Roundtrip, eine Transaktion).
 * Erzwingen lässt sich die Prüfung mit FORCE_SCHEMA_CHECK=true in der .env (z. B. nach manuellen Eingriffen in die DB).
 */
export async function ensureTables() {
    const started = Date.now();
    const statements = [...OLD_SCHEMA.map(([, ddl]) => ddl), ...EXTENSIONS];
    const fingerprint = createHash("sha1").update(statements.join("\n")).digest("hex");
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
        const { rows } = await client.query(`SELECT value FROM schema_meta WHERE key = 'schema_fingerprint';`);
        if (rows[0]?.value === fingerprint && process.env.FORCE_SCHEMA_CHECK !== "true") {
            logger.info(`Datenbankschema ist aktuell (${Date.now() - started} ms).`);
            return;
        }
        await client.query(statements.join("\n"));
        await client.query(
            `INSERT INTO schema_meta (key, value) VALUES ('schema_fingerprint', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`,
            [fingerprint],
        );
        logger.info(`Datenbankschema ist bereit (${statements.length} Befehle, ${Date.now() - started} ms).`);
    } catch (e) {
        logger.error("Fehler beim Erstellen des Datenbankschemas:", e);
        throw e;
    } finally {
        client.release();
    }
}

/** Kanalname ohne # und in Kleinbuchstaben */
export const cleanChannel = (c) => String(c).replace(/#+/g, "").toLowerCase();

/** Stellt sicher, dass ein Kanal (streamer-Zeile) existiert. */
export async function ensureChannel(channel) {
    await pool.query(`INSERT INTO streamer (name, automessage) VALUES ($1, true) ON CONFLICT DO NOTHING;`, [
        cleanChannel(channel),
    ]);
}
