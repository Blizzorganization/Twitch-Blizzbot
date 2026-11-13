import { modHelix } from "./client.js";
import { getUser } from "./channel.js";

/** Moderations-Aktionen über Helix: Nachricht löschen, Timeout/Ban, Follower-Modus, Shoutout. */

/** Scope: moderator:manage:chat_messages */
export async function deleteMessage(channel, messageId) {
    await modHelix(channel, "/moderation/chat", { method: "DELETE", query: { message_id: messageId } });
}

/** Timeout (duration in Sekunden) oder Bann (ohne duration). Scope: moderator:manage:banned_users */
export async function banUser(channel, userId, { duration, reason } = {}) {
    await modHelix(channel, "/moderation/bans", {
        method: "POST",
        body: { data: { user_id: userId, ...(duration ? { duration } : {}), reason: (reason ?? "").slice(0, 500) } },
    });
}

/** minutes = null schaltet den Follower-Modus aus. Scope: moderator:manage:chat_settings */
export async function setFollowersMode(channel, minutes) {
    await modHelix(channel, "/chat/settings", {
        method: "PATCH",
        body: minutes === null ? { follower_mode: false } : { follower_mode: true, follower_mode_duration: minutes },
    });
}

/** Sendet Twitchs eigenen Shoutout (eigener Chat-Eintrag + Empfehlung in Twitchs Stream-Browse). Scope: moderator:manage:shoutouts */
export async function sendShoutout(channel, toLogin) {
    const target = await getUser(channel, toLogin);
    if (!target) return null;
    await modHelix(channel, "/chat/shoutouts", {
        method: "POST",
        broadcasterParam: "from_broadcaster_id",
        query: { to_broadcaster_id: target.id },
    });
    return target;
}
