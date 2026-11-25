import { Client, GatewayIntentBits, MessageFlags, REST, Routes } from "discord.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { logEvent } from "../db/events.js";
import { adminDefs, publicDefs, ADMIN_NAMES, PUBLIC_REPLY_NAMES } from "./definitions.js";
import { isAllowed } from "./util.js";
import { loadDiscordSettings, seedDiscordSettingsFromEnv, activeDiscordSettings, effectivePublicGuildIds, settingsForGuild, discordSettingsFor } from "../db/discord-settings.js";
import { blacklistPayload } from "./blacklist-channel.js";
import { handleAdmin } from "./handlers/admin.js";
import { handlePublic, top10Payload } from "./handlers/public.js";
import { handleSay } from "./say.js";
import { getClient, setClient, clearClient, markStarted, markReady, markError, setRegisteredCommands } from "./state.js";

/**
 * Einstieg für den Discord-Teil. Aufbau:
 *   definitions.js        Slash-Command-Definitionen (Verwaltung / Nutzer)
 *   handlers/admin.js     Logik der Verwaltungs-Commands
 *   handlers/public.js    Logik der Nutzer-Commands (/watchtime, /top10, /zitat, ...)
 *   blacklist-channel.js  Blacklist in den Discord-Kanal schicken
 *   say.js                Discord-Kanal -> Twitch-Chat
 *   state.js              Client + Status (fürs Dashboard)
 *   embeds.js             alle Embeds
 */
export { sendBlacklist, hasBlacklistChannel } from "./blacklist-channel.js";
export { discordStatus } from "./state.js";

async function handleButton(interaction) {
    const [kind, arg, chan] = interaction.customId.split(":");
    if (kind === "top10") {
        // Der Kanal steckt im Button; er muss zu dem Server passen, auf dem geklickt wurde
        const s = settingsForGuild(interaction.guildId, "public");
        if (!s || s.channel !== chan) return interaction.reply({ content: "⛔ Dieser Server gehört nicht zu diesem Kanal.", flags: MessageFlags.Ephemeral });
        return interaction.update(await top10Payload(Math.max(1, Number(arg) || 1), s));
    }
    if (kind === "refresh-blacklist") {
        const s = settingsForGuild(interaction.guildId, "admin");
        if (!s || s.channel !== arg || !isAllowed(interaction, s)) return interaction.reply({ content: "⛔ Dafür fehlt dir die Berechtigung.", flags: MessageFlags.Ephemeral });
        return interaction.update(await blacklistPayload(arg));
    }
}

async function handleInteraction(interaction) {
    try {
        if (interaction.isButton()) return await handleButton(interaction);
        if (!interaction.isChatInputCommand()) return;

        if (ADMIN_NAMES.has(interaction.commandName)) {
            const s = settingsForGuild(interaction.guildId, "admin");
            if (!s) return interaction.reply({ content: "⛔ Dieser Server ist für keinen Twitch-Kanal eingerichtet (Dashboard: Verwaltung → Discord).", flags: MessageFlags.Ephemeral });
            if (!isAllowed(interaction, s)) {
                return interaction.reply({ content: "⛔ Dafür fehlt dir die Berechtigung.", flags: MessageFlags.Ephemeral });
            }
            const result = await handleAdmin(interaction, s);
            // /add /edit /del /view /commands sind bewusst NICHT "versteckt": andere Moderatoren sollen
            // im Kanal sehen, wenn jemand einen Command anlegt/ändert/löscht bzw. sich die Übersicht ansieht.
            const ephemeral = !PUBLIC_REPLY_NAMES.has(interaction.commandName);
            const base = ephemeral ? { flags: MessageFlags.Ephemeral } : {};
            const payload = typeof result === "string" ? { content: result, ...base } : { ...base, ...result };
            await interaction.reply(payload);
            logEvent(s.channel, "discord_command", interaction.user.tag, { command: interaction.commandName });
        } else {
            const s = settingsForGuild(interaction.guildId, "public");
            if (!s) return await interaction.reply({ content: "⛔ Dieser Server ist für keinen Twitch-Kanal eingerichtet.", flags: MessageFlags.Ephemeral });
            await interaction.reply(await handlePublic(interaction, s));
        }
    } catch (e) {
        logger.error("Discord-Fehler:", e);
        const payload = { content: "❌ Es ist ein Fehler aufgetreten.", flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
    }
}

const registeredGuilds = new Set(); // Server, auf denen wir zuletzt Commands registriert haben (zum Aufräumen)

/**
 * Registriert die Slash-Commands pro Server. Die Zuordnung kommt aus den Einstellungen aller eingeschalteten Kanäle:
 * Server aus guild_ids bekommen die Verwaltungs-Commands, Server aus public_guild_ids (leer = wie guild_ids) die Nutzer-Commands.
 * Pro Server wird nur EINMAL registriert (ein zweiter PUT würde den ersten überschreiben). Server, die nicht mehr
 * eingetragen sind, werden geleert.
 */
async function registerCommands() {
    const { token, clientId } = config.discord;
    const plan = new Map(); // guildId -> { admin, pub }
    for (const s of activeDiscordSettings()) {
        for (const id of s.guildIds) plan.set(id, { ...(plan.get(id) ?? {}), admin: true });
        for (const id of effectivePublicGuildIds(s)) plan.set(id, { ...(plan.get(id) ?? {}), pub: true });
    }
    const rest = new REST({ version: "10" }).setToken(token);
    let total = 0;
    for (const [id, { admin, pub }] of plan) {
        const body = [...(admin ? adminDefs : []), ...(pub ? publicDefs : [])];
        try {
            await rest.put(Routes.applicationGuildCommands(clientId, id), { body });
            total += body.length;
            logger.debug(`Discord-Commands registriert auf Server ${id}: ${body.length} (${admin ? "Verwaltung" : ""}${admin && pub ? " + " : ""}${pub ? "Nutzer" : ""})`);
        } catch (e) {
            logger.warn(`Discord-Commands auf Server ${id} nicht registrierbar (Bot dort eingeladen? Scope applications.commands?): ${e?.message ?? e}`);
        }
    }
    for (const id of registeredGuilds) {
        if (plan.has(id)) continue;
        try {
            await rest.put(Routes.applicationGuildCommands(clientId, id), { body: [] });
            logger.debug(`Discord-Commands von Server ${id} entfernt (nicht mehr eingetragen).`);
        } catch (e) {
            logger.warn(`Discord-Commands auf Server ${id} konnten nicht entfernt werden: ${e?.message ?? e}`);
        }
    }
    registeredGuilds.clear();
    for (const id of plan.keys()) registeredGuilds.add(id);
    setRegisteredCommands(total);
}

let reloadChain = Promise.resolve();

/**
 * Lädt die Einstellungen neu und registriert die Commands neu (nach Änderungen im Dashboard, ohne Neustart).
 * Die Registrierung bei Discord kann dauern (je Server ein Web-Aufruf), darum läuft sie im Hintergrund und
 * mehrere Änderungen hintereinander werden nacheinander abgearbeitet. Die Einstellungen selbst gelten sofort.
 */
export function reloadDiscord() {
    const run = async () => {
        await loadDiscordSettings();
        if (!config.discord.enabled || !getClient()) return;
        const started = Date.now();
        await registerCommands();
        logger.debug(`Discord-Commands neu registriert (${Date.now() - started} ms).`);
    };
    reloadChain = reloadChain.then(run).catch((e) => logger.warn(`Discord-Commands konnten nicht neu registriert werden: ${e?.message ?? e}`));
    return reloadChain;
}

export async function startDiscordBot() {
    const { token, clientId } = config.discord;
    markStarted();
    try {
        if (!token || !clientId) throw new Error("DISCORD_TOKEN und DISCORD_CLIENT_ID müssen gesetzt sein.");
        // Einstellungen pro Kanal liegen in der DB; beim ersten Start werden die alten .env-Werte übernommen
        if (await seedDiscordSettingsFromEnv()) logger.info("Discord: bisherige .env-Werte als Einstellung für Kanal \"" + config.discord.twitchChannel + "\" übernommen (ab jetzt im Dashboard: Verwaltung → Discord).");
        await loadDiscordSettings();
        if (!activeDiscordSettings().some((s) => s.guildIds.length)) logger.info("Discord: noch kein Kanal eingerichtet (Dashboard: Verwaltung → Discord). Der Bot verbindet sich trotzdem.");
        await registerCommands();

        // GuildMessages + MessageContent werden für die "say"-Funktion benötigt (Nachrichten aus einem Discord-Kanal
        // 1:1 in den Twitch-Chat posten). MessageContent ist ein "privileged intent" und muss im Discord-Developer-Portal
        // für den Bot aktiviert werden, sonst verbindet sich der Bot zwar, sieht aber keine Nachrichteninhalte.
        const client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        });
        setClient(client);

        // Ohne einen "error"-Listener wirft Node bei einem Verbindungsfehler eine uncaughtException und
        // der ganze Prozess stürzt ab - das war vermutlich die Ursache der gelegentlichen Abstürze.
        client.on("error", (e) => { markError(e); logger.error("Discord-Client-Fehler:", e); });
        client.on("shardError", (e) => { markError(e); logger.error("Discord-Shard-Fehler:", e); });
        // Verbindungsabbrüche und Wiederverbinden (discord.js verbindet selbst neu) für die Fehlerliste im Dashboard
        let discordLost = false;
        client.on("shardDisconnect", (event) => {
            discordLost = true;
            logger.warn(`Discord getrennt: ${event?.code ?? "Verbindung verloren"}`);
        });
        const discordBack = () => {
            if (!discordLost) return;
            discordLost = false;
            logger.ok("Discord wieder verbunden");
        };
        client.on("shardResume", discordBack);
        client.on("shardReady", discordBack);
        client.on("messageCreate", (message) => {
            handleSay(message).catch((e) => logger.error("Discord-say-Relay fehlgeschlagen:", e));
        });
        client.on("interactionCreate", handleInteraction);
        client.once("clientReady", () => {
            markReady();
            logger.info(`Discord verbunden als ${client.user.tag}`);
        });
        await client.login(token);
        return client;
    } catch (e) {
        markError(e);
        throw e;
    }
}

/** Trennt die Discord-Verbindung sauber (für einen geordneten Shutdown, siehe index.js). */
export async function stopDiscordBot() {
    const client = getClient();
    if (!client) return;
    try {
        await client.destroy();
        logger.info("Discord-Verbindung getrennt.");
    } catch (e) {
        logger.warn(`Discord-Verbindung konnte nicht sauber getrennt werden: ${e?.message ?? e}`);
    } finally {
        clearClient();
    }
}
