import { UserError } from "../utils/errors.js";
import { getChannelSettings } from "../db/channel-settings.js";
import { logger } from "../utils/logger.js";
import { apiConfigured, createChannelReward, deleteChannelReward, updateRedemptionStatus } from "../twitch/api.js";
import {
    listChannelRewards,
    getChannelReward,
    createChannelRewardRow,
    deleteChannelRewardRow,
    listRedemptions,
    addRedemption,
    markRedemptionFulfilled,
} from "../db/channel-rewards.js";

/** Vom Dashboard: neue Channel-Points-Reward anlegen (gehört danach dem Bot, Scope channel:manage:redemptions). */
export async function createReward(channel, { title, cost, prompt, userInputRequired }) {
    if (!apiConfigured()) throw new UserError("Twitch-API ist nicht konfiguriert.");
    if (!(await getChannelSettings(channel)).rewardsEnabled) throw new UserError("Das Reward-System ist für diesen Kanal ausgeschaltet.");
    if (!title?.trim()) throw new UserError("Ein Titel ist Pflicht.");
    const costNum = Number(cost);
    if (!Number.isFinite(costNum) || costNum < 1) throw new UserError("Kosten müssen eine Zahl größer 0 sein.");

    const created = await createChannelReward(channel, { title: title.trim(), cost: costNum, prompt, userInputRequired });
    if (!created) throw new UserError("Reward konnte nicht erstellt werden (Scope channel:manage:redemptions?).");

    return createChannelRewardRow(channel, {
        twitchRewardId: created.id,
        title: created.title,
        cost: created.cost,
        prompt: created.prompt || null,
        userInputRequired: created.is_user_input_required,
    });
}

/** Löscht eine Reward (nur möglich, weil sie vom Bot selbst angelegt wurde). */
export async function removeReward(channel, id) {
    const row = await getChannelReward(channel, id);
    if (!row) throw new UserError("Reward nicht gefunden.");
    try {
        await deleteChannelReward(channel, row.twitch_reward_id);
    } catch (e) {
        logger.warn(`Reward "${row.title}" konnte bei Twitch nicht gelöscht werden (evtl. schon manuell entfernt): ${e.message}`);
    }
    await deleteChannelRewardRow(channel, id);
    return true;
}

export async function listAllRewards(channel) {
    return listChannelRewards(channel);
}

export async function listAllRedemptions(channel) {
    return listRedemptions(channel);
}

/**
 * Wird von eventsub.js für JEDE Einlösung JEDER Reward eines Kanals aufgerufen (auch manuell im
 * Twitch-Dashboard angelegte Rewards, nicht nur vom Bot selbst angelegte). Trägt die Einlösung ins
 * Dashboard-Protokoll ein und versucht danach, sie bei Twitch als erledigt ("FULFILLED") zu markieren -
 * das gelingt nur für Rewards, die der Bot selbst angelegt hat (Twitch-Einschränkung), für alle anderen
 * bleibt die Einlösung in Twitchs eigener Liste als "offen" stehen, wird hier aber trotzdem protokolliert.
 */
export async function handleRedemptionEvent(channel, event) {
    // Reward-System für diesen Kanal ausgeschaltet (Dashboard -> Aktionen -> Rewards): Einlösung nicht protokollieren/erledigen
    if (!(await getChannelSettings(channel)).rewardsEnabled) return;
    const isNew = await addRedemption(channel, {
        twitchRewardId: event.rewardId,
        rewardTitle: event.rewardTitle,
        rewardCost: event.rewardCost,
        twitchRedemptionId: event.id,
        userName: event.userName,
        userInput: event.input || null,
        redeemedAt: event.redemptionDate,
    });
    if (!isNew) return; // schon bekannt (z. B. nach einem Reconnect erneut zugestellt)

    try {
        await updateRedemptionStatus(channel, event.rewardId, [event.id], "FULFILLED");
        await markRedemptionFulfilled(channel, event.id);
    } catch (e) {
        logger.debug(`Einlösung ${event.id} (${channel}, Reward "${event.rewardTitle}") konnte nicht automatisch erledigt werden: ${e.message}`);
    }
}
