import { ChatClient } from "@twurple/chat";
import { createChatAuthProvider } from "./chatAuth.js";
import { config, PERMISSIONS } from "../config.js";
import { logger } from "../utils/logger.js";
import { ensureChannel } from "../db/init.js";
import { resolveCommand, incrementUses } from "../db/commands.js";
import { fillPlaceholders } from "./placeholders.js";
import { logEvent } from "../db/events.js";
import { checkCooldown } from "./cooldown.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { getPermission, checkModAction } from "./moderation.js";
import { refreshBotMods } from "../db/bot-mods.js";
import { registerAlerts } from "./alerts.js";
import { findInternal, getInternalState } from "./commands.js";
import { startWatchtime, stopWatchtime } from "./watchtime.js";
import { startAutomessage, stopAutomessage, countChatMessage } from "./automessage.js";
import { startEventSub, stopEventSub } from "./eventsub.js";
import { startModLog, stopModLog } from "./modlog.js";
import { setAnnouncer } from "../services/announce.js";
import { handleGiveawayMessage, resumeGiveaways } from "../services/giveaway.js";
import { handlePollMessage, resumePolls } from "../services/poll.js";
import { resumeTimers } from "../services/timer.js";
import { handleMessageXp } from "../services/leveling.js";
import { handleGreeting } from "../services/greeting.js";

export let client;
let chatConnected = false;

/** Ob der Chat gerade verbunden ist (für die Status-Übersicht im Dashboard). */
export const isChatConnected = () => chatConnected;

/* ------------------------------- Hilfsfunktionen ------------------------------- */

function limit(text) {
    // Twitch-Limit: 500 Zeichen
    return text.length > 480 ? text.slice(0, 477) + "..." : text;
}

export function say(channel, text) {
    if (!client) return;
    client.say(channel, limit(text)).catch((e) => logger.error("say() fehlgeschlagen:", e));
}

/** Nachricht als /me (kursiv, wie die Alerts im alten Bot). */
export function action(channel, text) {
    if (!client) return;
    client.action(channel, limit(text)).catch((e) => logger.error("action() fehlgeschlagen:", e));
}

function countEmotes(msg) {
    try {
        let n = 0;
        for (const ranges of msg.emoteOffsets?.values?.() ?? []) n += ranges.length;
        return n;
    } catch {
        return 0;
    }
}

/**
 * Baut aus twurples ChatMessage/ChatUser-Objekten ein flaches "tags"-Objekt im Stil von tmi.js,
 * damit moderation.js, commands.js usw. unverändert bleiben können.
 */
function toTags(channel, username, msg, isAction) {
    const info = msg.userInfo;
    return {
        channel,
        username,
        "display-name": info.displayName,
        "user-id": info.userId,
        mod: info.isMod,
        subscriber: info.isSubscriber,
        badges: { broadcaster: info.isBroadcaster, vip: info.isVip },
        id: msg.id,
        // Anzahl der Twitch-Emotes in der Nachricht (für den Emote-Spam-Filter)
        emoteCount: countEmotes(msg),
        "message-type": isAction ? "action" : "chat",
    };
}

/* ------------------------------- Nachrichten ------------------------------- */

const ALWAYS_ON = new Set(["help", "switch"]); // lassen sich nicht ausschalten (sonst sperrt man sich aus)
const lastInternalRun = new Map(); // channel -> Zeitstempel (globaler Cooldown für eingebaute Commands)

async function handleInternal(channel, tags, args, typed, permission) {
    const cmd = findInternal(typed);
    if (!cmd) return false;

    // Per !switch abgeschaltet? (Tabelle "commands" des alten Bots; kanonischer Name oder getippter Alias)
    const state = (await getInternalState(channel, cmd.name)) ?? (typed !== cmd.name ? await getInternalState(channel, typed) : null);
    if (state?.enabled === false && !ALWAYS_ON.has(cmd.name)) return true;

    const need = state && state.permission >= 0 ? state.permission : cmd.perm;
    if (need && permission < need) {
        if (!cmd.silent) say(channel, "Du hast keine Rechte");
        return true;
    }

    const isMod = permission >= PERMISSIONS.MODERATOR;
    const { cooldown } = await getChannelSettings(channel);
    const wait = Date.now() - (lastInternalRun.get(channel) ?? 0);
    if (!isMod && cooldown > 0 && wait <= cooldown * 1000) return true;

    const ctx = {
        name: cmd.name,
        channel,
        target: channel,
        tags,
        args,
        permission,
        user: tags["display-name"] ?? tags.username,
        say: (t) => say(channel, t),
        action: (t) => action(channel, t),
    };
    try {
        await cmd.run(ctx);
        logEvent(channel, "command", tags.username, { command: cmd.name, builtin: true });
    } catch (e) {
        logger.error(`Ausführung von !${cmd.name} fehlgeschlagen: ${e?.message ?? e}`);
    } finally {
        lastInternalRun.set(channel, Date.now());
    }
    return true;
}

async function handleCustom(channel, tags, args, typed, permission) {
    const cmd = await resolveCommand(channel, typed);
    if (!cmd) return false;
    if (cmd.enabled === false) return false; // deaktivierter Command: so tun, als gäbe es ihn nicht
    if ((cmd.permission ?? 0) > permission) {
        say(channel, "Du hast keine Rechte für diesen Command");
        return true;
    }
    const wait = checkCooldown(channel, cmd.command, tags.username, cmd.cooldown, permission >= PERMISSIONS.MODERATOR);
    if (wait > 0) {
        logger.debug(`Cooldown ${cmd.command}: noch ${wait}s`);
        return true;
    }
    await incrementUses(channel, cmd.command);
    const user = tags["display-name"] ?? tags.username;
    const text = await fillPlaceholders(cmd.response ?? "", { user, channel, args, uses: cmd.uses + 1 });
    if (text.trim()) say(channel, text);
    logEvent(channel, "command", tags.username, { command: cmd.command, alias: cmd.command !== typed ? typed : undefined });
    return true;
}

async function onChatMessage(channel, username, message, msg, isAction) {
    try {
        const tags = toTags(channel, username, msg, isAction);
        if (await checkModAction(channel, tags, message)) return;
        logEvent(channel, "message", username, {});
        countChatMessage(channel);
        handleMessageXp(channel, tags).catch((e) => logger.warn(`Nachrichten-XP fehlgeschlagen: ${e.message}`));
        handleGreeting(channel, tags).catch((e) => logger.warn(`Begrüßung fehlgeschlagen: ${e.message}`));

        const prefix = config.bot.prefix;
        if (!message.startsWith(prefix)) {
            // Giveaway-Stichwort oder Umfrage-Stimme (per Zahl) – beides läuft ohne "!"
            if (await handleGiveawayMessage(channel, tags, message)) {
                logEvent(channel, "giveaway_entry", username, {});
            } else {
                await handlePollMessage(channel, tags, message);
            }
            return;
        }
        const [rawName, ...args] = message.trim().split(/\s+/);
        const typed = rawName.slice(prefix.length).toLowerCase();
        if (!typed) return;

        const permission = getPermission(tags);
        if (await handleInternal(channel, tags, args, typed, permission)) return;
        await handleCustom(channel, tags, args, typed, permission);
    } catch (e) {
        logger.error("Fehler bei der Nachrichtenverarbeitung:", e);
    }
}

/* ------------------------------ Chat-Listener ------------------------------ */

/** Normale Chatnachrichten und /me-Nachrichten (Alerts hängen in alerts.js an denselben Client). */
function registerChatHandlers() {
    client.onMessage((channel, username, text, msg) => onChatMessage(channel, username, text, msg, false));
    client.onAction((channel, username, text, msg) => onChatMessage(channel, username, text, msg, true));
}

/* ---------------------------------- Start ---------------------------------- */

export async function startTwitchBot() {
    if (!config.twitch.username || !config.twitch.chatAuth.accessToken || !config.twitch.channels.length) {
        throw new Error("TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN (oder TWITCH_BOT_ACCESS_TOKEN) und TWITCH_CHANNELS müssen gesetzt sein.");
    }
    for (const c of config.twitch.channels) await ensureChannel(c);

    const authProvider = await createChatAuthProvider();
    client = new ChatClient({
        authProvider,
        channels: config.twitch.channels,
    });

    let servicesStarted = false;
    let wasDisconnected = false;
    client.onConnect(() => {
        chatConnected = true;
        if (wasDisconnected) {
            wasDisconnected = false;
            logger.ok("Twitch wieder verbunden");
        }
        logger.info(`Twitch verbunden – Kanäle: ${config.twitch.channels.join(", ")}`);
        if (servicesStarted) return; // bei Reconnects nicht doppelt starten
        servicesStarted = true;
        // Dashboard-Nachrichten (Giveaway/Umfrage/Alert-Test) werden normal gesendet, nicht farbig als /me.
        setAnnouncer((c, t, asAction) => (asAction ? action(c, t) : say(c, t)));
        refreshBotMods().catch((e) => logger.warn(`Verify-Mods konnten nicht geladen werden: ${e.message}`));
        setInterval(() => refreshBotMods().catch(() => {}), 60_000).unref();
        startWatchtime();
        startAutomessage(say);
        startEventSub().catch((e) => logger.error("Punkte-Reward-Erfassung (EventSub) konnte nicht gestartet werden:", e));
        startModLog().catch((e) => logger.error("Moderator-Aktionen-Erfassung konnte nicht gestartet werden:", e));
        resumeGiveaways().catch((e) => logger.error("Giveaways konnten nicht fortgesetzt werden:", e));
        resumePolls().catch((e) => logger.error("Umfragen konnten nicht fortgesetzt werden:", e));
        resumeTimers().catch((e) => logger.error("Timer konnten nicht fortgesetzt werden:", e));
    });
    client.onDisconnect((manually, reason) => {
        chatConnected = false;
        wasDisconnected = true;
        logger.warn("Twitch getrennt:", reason?.message ?? (manually ? "manuell" : "Verbindung verloren"));
    });
    client.onAuthenticationFailure((text) => logger.error("Twitch-Authentifizierung fehlgeschlagen:", text));
    // Reihenfolge wie bisher: erst Alerts (z. B. Bit-Cheers), dann die normale Chat-Verarbeitung
    registerAlerts(client, { say, action });
    registerChatHandlers();

    client.connect();
    return client;
}

/**
 * Trennt ALLE Twitch-Verbindungen sauber (für einen geordneten Shutdown, siehe index.js):
 * Watchtime-Erfassung, Automessages, die EventSub-WebSockets (Punkte-Rewards, Moderator-Aktionen) und den Chat. Twitch erlaubt nur wenige
 * gleichzeitige WebSockets pro Account - nicht geschlossene Verbindungen blockieren sonst den nächsten Start.
 */
export async function stopTwitchBot() {
    stopWatchtime();
    stopAutomessage();
    for (const [name, stop] of [["Punkte-Reward-Erfassung (EventSub)", stopEventSub], ["Moderator-Aktionen-Erfassung", stopModLog]]) {
        try {
            await stop();
        } catch (e) {
            logger.warn(`${name} konnte nicht sauber getrennt werden: ${e?.message ?? e}`);
        }
    }
    if (!client) return;
    try {
        // quit() meldet sauber ab und schaltet den Auto-Reconnect aus (danach kann diese Instanz
        // nicht erneut verbunden werden - für ein Shutdown ist das genau richtig).
        await client.quit();
        logger.info("Twitch-Verbindung getrennt.");
    } catch (e) {
        logger.warn(`Twitch-Verbindung konnte nicht sauber getrennt werden: ${e?.message ?? e}`);
    } finally {
        client = undefined;
    }
}
