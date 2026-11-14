import { Client, GatewayIntentBits, MessageFlags, REST, Routes } from "discord.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { logEvent } from "../db/events.js";
import { adminDefs, publicDefs, ADMIN_NAMES, PUBLIC_REPLY_NAMES } from "./definitions.js";
import { isAllowed } from "./util.js";
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
export { sendBlacklist } from "./blacklist-channel.js";
export { discordStatus } from "./state.js";

async function handleButton(interaction) {
    const [kind, arg] = interaction.customId.split(":");
    if (kind === "top10") return interaction.update(await top10Payload(Math.max(1, Number(arg) || 1)));
    if (kind === "refresh-blacklist") {
        if (!isAllowed(interaction)) return interaction.reply({ content: "⛔ Dafür fehlt dir die Berechtigung.", flags: MessageFlags.Ephemeral });
        return interaction.update(await blacklistPayload(arg));
    }
}

async function handleInteraction(interaction) {
    try {
        if (interaction.isButton()) return await handleButton(interaction);
        if (!interaction.isChatInputCommand()) return;

        if (ADMIN_NAMES.has(interaction.commandName)) {
            if (!isAllowed(interaction)) {
                return interaction.reply({ content: "⛔ Dafür fehlt dir die Berechtigung.", flags: MessageFlags.Ephemeral });
            }
            const result = await handleAdmin(interaction);
            // /add /edit /del /view /commands sind bewusst NICHT "versteckt": andere Moderatoren sollen
            // im Kanal sehen, wenn jemand einen Command anlegt/ändert/löscht bzw. sich die Übersicht ansieht.
            const ephemeral = !PUBLIC_REPLY_NAMES.has(interaction.commandName);
            const base = ephemeral ? { flags: MessageFlags.Ephemeral } : {};
            const payload = typeof result === "string" ? { content: result, ...base } : { ...base, ...result };
            await interaction.reply(payload);
            logEvent((interaction.options.getString("channel") ?? config.discord.twitchChannel ?? "").toLowerCase(),
                "discord_command", interaction.user.tag, { command: interaction.commandName });
        } else {
            await interaction.reply(await handlePublic(interaction));
        }
    } catch (e) {
        logger.error("Discord-Fehler:", e);
        const payload = { content: "❌ Es ist ein Fehler aufgetreten.", flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
    }
}

/** Registriert die Slash-Commands pro Server (Verwaltung und/oder Nutzer, je nach Konfiguration). */
async function registerCommands() {
    const { token, clientId, guildIds } = config.discord;
    // Ohne eigene DISCORD_PUBLIC_GUILD_ID laufen Verwaltungs- und Nutzer-Commands wie bisher auf denselben Server(n).
    const publicGuildIds = config.discord.publicGuildIds.length ? config.discord.publicGuildIds : guildIds;

    const rest = new REST({ version: "10" }).setToken(token);
    // Pro Server NUR EINMAL registrieren (ein zweiter PUT würde den ersten überschreiben), mit der
    // Vereinigung aus Verwaltungs- und/oder Nutzer-Commands, je nachdem wofür dieser Server konfiguriert ist.
    const allGuildIds = new Set([...guildIds, ...publicGuildIds]);
    let total = 0;
    for (const id of allGuildIds) {
        const body = [...(guildIds.includes(id) ? adminDefs : []), ...(publicGuildIds.includes(id) ? publicDefs : [])];
        await rest.put(Routes.applicationGuildCommands(clientId, id), { body });
        total += body.length;
        logger.info(`Discord-Commands registriert auf Server ${id}: ${body.length} (${guildIds.includes(id) ? "Verwaltung" : ""}${guildIds.includes(id) && publicGuildIds.includes(id) ? " + " : ""}${publicGuildIds.includes(id) ? "Nutzer" : ""})`);
    }
    setRegisteredCommands(total);
}

export async function startDiscordBot() {
    const { token, clientId, guildIds } = config.discord;
    markStarted();
    try {
        if (!token || !clientId || !guildIds.length) throw new Error("DISCORD_TOKEN, DISCORD_CLIENT_ID und DISCORD_GUILD_ID müssen gesetzt sein.");
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
