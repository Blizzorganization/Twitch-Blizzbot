import { logger } from "../utils/logger.js";
import { logEvent, addSubs } from "../db/events.js";
import { getAlertTemplate, getAlertEnabled, getAlertAsAction, formatAlert } from "../db/alerts.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { registerCommunityGift, isPartOfCommunityGift } from "../services/gift-dedupe.js";
import { startRaidPause } from "../services/raid-pause.js";

/**
 * Alerts (Sub, Resub, Bits, Raid, Gift, Mass-Gift, Upgrades) aus dem Twitch-Chat.
 * bot.js ruft registerAlerts(client, { say, action }) einmal beim Start auf.
 */

// say/action kommen von bot.js (so gibt es keine Rundum-Abhängigkeit zwischen den Dateien)
let out = { say: () => {}, action: () => {} };
const say = (channel, text) => out.say(channel, text);
const action = (channel, text) => out.action(channel, text);

/* Alert-Texte kommen jetzt aus der Datenbank (Tabelle alert_messages, editierbar im Dashboard-Tab
   "Alerts"); die Standardtexte stehen als Fallback in db/alerts.js (ALERT_TYPES). */
async function say_alert(channel, type, context) {
    if (!(await getAlertEnabled(channel, type))) return;
    const template = await getAlertTemplate(channel, type);
    const text = formatAlert(template, context);
    if (await getAlertAsAction(channel, type)) action(channel, text);
    else say(channel, text);
}

/** Wandelt twurples subInfo.plan ("1000"/"2000"/"3000"/"Prime") in eine lesbare Tier-Bezeichnung um. */
function tierLabel(plan) {
    switch (String(plan)) {
        case "1000":
            return "Tier 1";
        case "2000":
            return "Tier 2";
        case "3000":
            return "Tier 3";
        case "Prime":
            return "Prime";
        default:
            return plan ? String(plan) : "Tier 1";
    }
}

/** Twitch-Kennung, die ein Mass-Gift und seine einzelnen Gift-Events verbindet (kann fehlen). */
function giftOriginId(msg) {
    const tags = msg?.tags ?? msg?._tags;
    return tags?.get?.("msg-param-origin-id") ?? null;
}

/**
 * Bei Twitchs "Shared Chat" (gemeinsamer Chat mehrerer Kanäle, z. B. bei Collabs) bekommt der Bot
 * über seine eine IRC-Verbindung auch Sub-/Resub-/Raid-/Bits-Events AUS DEN ANDEREN beteiligten
 * Kanälen hinein gespiegelt. Twitch markiert solche gespiegelten Events mit dem Tag "source-room-id"
 * (ChatMessage: "sourceChannelId"), das sich dann von "room-id" (dem eigenen Kanal, "channelId")
 * unterscheidet. Fehlt das Tag oder ist es gleich dem eigenen Kanal, ist das Event original von hier.
 */
function isFromOtherSharedChatChannel(msg) {
    // ChatMessage (PRIVMSG, z. B. Bit-Cheers über onMessage) hat "sourceChannelId" als eigenen Getter;
    // UserNotice (Sub/Resub/Raid/Gift/...) nicht - dort direkt auf das rohe IRC-Tag zugreifen.
    const source = msg?.sourceChannelId ?? msg?._tags?.get?.("source-room-id") ?? null;
    return !!source && source !== msg?.channelId;
}

export function registerAlerts(chatClient, io) {
    out = io;
    const client = chatClient;
    client.onSub((channel, username, subInfo, msg) => {
        if (isFromOtherSharedChatChannel(msg)) return;
        say_alert(channel, "sub", { user: subInfo.displayName ?? username, tier: tierLabel(subInfo.plan) });
        logEvent(channel, "alert_sub", username, { plan: subInfo.plan, prime: subInfo.isPrime });
    });

    client.onResub((channel, username, subInfo, msg) => {
        if (isFromOtherSharedChatChannel(msg)) return;
        // Nachricht, die der Abonnent beim Resub mitgeschickt hat (wie im alten Bot: " Mit der Nachricht: ...")
        const message = String(subInfo.message ?? "").trim();
        say_alert(channel, "resub", {
            user: subInfo.displayName ?? username,
            months: subInfo.months,
            tier: tierLabel(subInfo.plan),
            message,
            withMessage: message ? ` Mit der Nachricht: ${message}` : "",
        });
        logEvent(channel, "alert_resub", username, { months: subInfo.months, plan: subInfo.plan });
    });

    // twurple liefert Bit-Cheers als normale Chat-Nachricht mit msg.bits > 0, kein eigenes Event.
    client.onMessage((channel, username, text, msg) => {
        if (msg.bits > 0 && !isFromOtherSharedChatChannel(msg)) {
            say_alert(channel, "cheer", { user: msg.userInfo.displayName ?? username, bits: msg.bits });
            logEvent(channel, "alert_bits", username, { bits: msg.bits });
            // Wie im alten Bot (tmi.js) löst eine Cheer-Nachricht den Bits-Alert aus UND wird zusätzlich
            // normal weiterverarbeitet (bot.js, kann z. B. trotzdem ein Command oder Giveaway-Stichwort sein).
        }
    });

    client.onRaid(async (channel, username, raidInfo, msg) => {
        if (isFromOtherSharedChatChannel(msg)) return;
        const { raidMinViewers, autoRaidEnabled, autoRaidMinViewers } = await getChannelSettings(channel);
        // Automatik: Follower-Modus bei einer großen Raid vorübergehend aus (wie !raid), unabhängig vom Raid-Alert
        if (autoRaidEnabled && raidInfo.viewerCount >= autoRaidMinViewers) {
            startRaidPause(channel, (t) => say(channel, t)).catch((e) => logger.warn(`Automatischer Raid-Schutz (${channel}) fehlgeschlagen: ${e.message}`));
        }
        if (raidInfo.viewerCount < raidMinViewers) return;
        say_alert(channel, "raid", { user: raidInfo.displayName ?? username, viewers: raidInfo.viewerCount });
        logEvent(channel, "alert_raid", username, { viewers: raidInfo.viewerCount });
    });

    // Einzelner Gift-Sub (nicht Teil eines Mass-Gifts); "username" ist hier der EMPFÄNGER, subInfo.gifter der Schenkende.
    client.onSubGift(async (channel, recipient, subInfo, msg) => {
        if (isFromOtherSharedChatChannel(msg)) return;
        const gifter = subInfo.gifter ?? "Anonym";
        // Teil eines Mass-Gifts? Dann gab es dafür schon EINE gemeinsame Meldung - keine Einzelmeldung/-zählung mehr.
        if (isPartOfCommunityGift(channel, gifter, giftOriginId(msg))) return;
        const total = await addSubs(channel, 1);
        say_alert(channel, "gift", { user: subInfo.gifterDisplayName ?? gifter, recipient: subInfo.displayName ?? recipient, total, tier: tierLabel(subInfo.plan) });
        logEvent(channel, "alert_gift", gifter, { recipient, total });
    });

    // Sub(s) an die Community verschenkt; "username" ist hier der Schenkende (Gifter).
    client.onCommunitySub(async (channel, username, communityInfo, msg) => {
        if (isFromOtherSharedChatChannel(msg)) return;
        registerCommunityGift(channel, communityInfo.gifter ?? username, communityInfo.count, giftOriginId(msg));
        const total = await addSubs(channel, communityInfo.count);
        const senderTotal = communityInfo.gifterGiftCount || communityInfo.count;
        say_alert(channel, "massgift", {
            user: communityInfo.gifterDisplayName ?? username,
            count: communityInfo.count,
            total,
            senderTotal,
        });
        logEvent(channel, "alert_gift", username, { count: communityInfo.count, total, senderTotal });
    });

    // Aus dem alten Bot: verlängerte Gift-/Prime-Subs
    client.onGiftPaidUpgrade((channel, username, info, msg) => {
        if (!isFromOtherSharedChatChannel(msg)) say_alert(channel, "giftupgrade", { user: info.displayName ?? username });
    });
    client.onPrimePaidUpgrade((channel, username, info, msg) => {
        if (!isFromOtherSharedChatChannel(msg)) say_alert(channel, "primeupgrade", { user: info.displayName ?? username });
    });
}
