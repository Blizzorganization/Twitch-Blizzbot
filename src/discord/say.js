import { logger } from "../utils/logger.js";
import { say } from "../twitch/bot.js";
import { settingsForSayChannel } from "../db/discord-settings.js";

/**
 * "say"-Funktion wie im alten Bot: Jede Nachricht im Say-Kanal eines Twitch-Kanals (Dashboard: Verwaltung -> Discord)
 * wird 1:1 in den Chat genau dieses Twitch-Kanals gepostet.
 */
export async function handleSay(message) {
    const s = settingsForSayChannel(message.channelId);
    if (!s) return;
    if (message.author.bot) return;
    const text = message.content?.trim();
    if (!text) return;
    say(s.channel, text);
    logger.debug(`Discord-say: ${message.author.tag} -> ${s.channel}`);
}
