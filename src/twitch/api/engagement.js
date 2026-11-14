import { broadcasterId, helix } from "./client.js";

/** Interaktion mit Zuschauern: Twitch-Umfragen, -Wetten und Kanalpunkte-Rewards. */

export async function createTwitchPoll(channel, title, choices, durationSeconds) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/polls", {
        method: "POST",
        body: {
            broadcaster_id: id,
            title: title.slice(0, 60),
            choices: choices.map((c) => ({ title: String(c).slice(0, 25) })),
            duration: Math.min(1800, Math.max(15, Math.round(durationSeconds))),
        },
    });
    return data?.data?.[0] ?? null;
}

export async function getTwitchPoll(channel, pollId) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/polls", { query: { broadcaster_id: id, id: pollId } });
    return data?.data?.[0] ?? null;
}

export async function endTwitchPoll(channel, pollId, status = "TERMINATED") {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/polls", { method: "PATCH", body: { broadcaster_id: id, id: pollId, status } });
    return data?.data?.[0] ?? null;
}

export async function createTwitchPrediction(channel, title, outcomes, durationSeconds) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/predictions", {
        method: "POST",
        body: {
            broadcaster_id: id,
            title: title.slice(0, 45),
            outcomes: outcomes.map((o) => ({ title: String(o).slice(0, 25) })),
            prediction_window: Math.min(1800, Math.max(30, Math.round(durationSeconds))),
        },
    });
    return data?.data?.[0] ?? null;
}

export async function getTwitchPrediction(channel, predictionId) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/predictions", { query: { broadcaster_id: id, id: predictionId } });
    return data?.data?.[0] ?? null;
}

/** status: LOCKED | RESOLVED | CANCELED. winningOutcomeId ist nur bei RESOLVED nötig. */
export async function endTwitchPrediction(channel, predictionId, status, winningOutcomeId) {
    const id = await broadcasterId(channel);
    const body = { broadcaster_id: id, id: predictionId, status };
    if (winningOutcomeId) body.winning_outcome_id = winningOutcomeId;
    const data = await helix(channel, "/predictions", { method: "PATCH", body });
    return data?.data?.[0] ?? null;
}

/** Legt eine neue Channel-Points-Reward an (gehört danach zu DIESER App/diesem Client-Token). */
export async function createChannelReward(channel, { title, cost, prompt, userInputRequired }) {
    const id = await broadcasterId(channel);
    const data = await helix(channel, "/channel_points/custom_rewards", {
        method: "POST",
        query: { broadcaster_id: id },
        body: {
            title: String(title).slice(0, 45),
            cost: Math.max(1, Math.round(cost)),
            prompt: prompt ? String(prompt).slice(0, 200) : undefined,
            is_user_input_required: !!userInputRequired,
        },
    });
    return data?.data?.[0] ?? null;
}

/** Löscht eine Reward wieder - geht nur für Rewards, die mit demselben Token/Client angelegt wurden. */
export async function deleteChannelReward(channel, rewardId) {
    const id = await broadcasterId(channel);
    await helix(channel, "/channel_points/custom_rewards", { method: "DELETE", query: { broadcaster_id: id, id: rewardId } });
}

/**
 * Markiert Einlösungen als erledigt ("FULFILLED") bzw. abgelehnt ("CANCELED"). Funktioniert nur für
 * Rewards, die mit demselben Client-Token angelegt wurden - bei allen anderen (z. B. manuell im
 * Twitch-Dashboard angelegten) schlägt der Aufruf erwartungsgemäß fehl, siehe eventsub.js. Twitch
 * erwartet hier mehrere "id"-Query-Parameter (bis zu 50), was URLSearchParams aus einem Objekt heraus
 * nicht abbilden kann - deshalb wird die Query-String hier manuell gebaut statt über den
 * "query"-Parameter von helix().
 */
export async function updateRedemptionStatus(channel, rewardId, redemptionIds, status) {
    const id = await broadcasterId(channel);
    const qs = new URLSearchParams({ broadcaster_id: id, reward_id: rewardId });
    for (const rid of redemptionIds) qs.append("id", rid);
    await helix(channel, `/channel_points/custom_rewards/redemptions?${qs}`, { method: "PATCH", body: { status } });
}
