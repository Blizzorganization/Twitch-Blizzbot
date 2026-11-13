import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { say } from "../twitch/bot.js";

/**
 * "say"-Funktion wie im alten Bot: Jede Nachricht, die im konfigurierten Discord-Kanal
 * (DISCORD_SAY_CHANNEL_ID) geschrieben wird, wird 1:1 in den Twitch-Chat gepostet.
 */
export async function handleSay(message) {
    const { sayChannelId, sayTwitchChannel } = config.discord;
    if (!sayChannelId || message.channelId !== sayChannelId) return;
    if (message.author.bot) return;
    const text = message.content?.trim();
    if (!text) return;
    if (!sayTwitchChannel) {
        logger.warn("DISCORD_SAY_CHANNEL_ID ist gesetzt, aber kein Twitch-Kanal (DISCORD_SAY_TWITCH_CHANNEL/DISCORD_TWITCH_CHANNEL/TWITCH_CHANNELS) konfiguriert.");
        return;
    }
    say(sayTwitchChannel, text);
}
