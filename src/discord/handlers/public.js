import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { formatSince, calcWatchtime } from "../../utils/time.js";
import { getWatchtime, watchtimeList, currentMonth } from "../../db/watchtime.js";
import { getUserStats, getUserRanks } from "../../db/leveling.js";
import { getTwitchName, getDiscordId, linkUser, unlinkUser } from "../../db/userlink.js";
import { getQuote, randomQuote } from "../../db/quotes.js";
import { getUser, getFollowedAt } from "../../twitch/api.js";
import { watchtimeEmbed, profileEmbed, top10Embed, linkingInfoEmbed, quoteEmbed } from "../embeds.js";

/** Nutzer-Commands für alle Mitglieder (/watchtime /profil /top10 /link /unlink /info /zitat). */
export async function top10Payload(page) {
    const channel = config.discord.twitchChannel;
    const rows = await watchtimeList(channel, "alltime", 10, page);
    const embed = top10Embed({ channel, rows, page, formatRow: (r) => calcWatchtime(r.watchtime) });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`top10:${page - 1}`).setLabel("Vorherige Seite").setStyle(ButtonStyle.Primary).setDisabled(page <= 1),
        new ButtonBuilder().setCustomId(`top10:${page + 1}`).setLabel("Nächste Seite").setStyle(ButtonStyle.Primary).setDisabled(rows.length < 10),
    );
    return { embeds: [embed], components: [row] };
}

export async function handlePublic(interaction) {
    const channel = config.discord.twitchChannel;
    switch (interaction.commandName) {
        case "watchtime": {
            const dcuser = interaction.options.getUser("user") ?? interaction.user;
            const twuser = interaction.options.getString("twitchuser")?.toLowerCase() ?? (await getTwitchName(dcuser.id));
            if (!twuser) return { content: "Du musst dich zuerst registrieren - /link" };
            const monthly = interaction.options.getBoolean("monat");
            const month = monthly ? currentMonth() : "alltime";
            const wt = await getWatchtime(channel, twuser, month);
            if (!wt) return { content: "Diesen Nutzer kenne ich nicht." };
            const max = (await getWatchtime(channel, config.twitch.username.toLowerCase(), month)) || wt;
            const embed = watchtimeEmbed({
                botAvatarUrl: interaction.client.user.avatarURL({ extension: "png" }),
                monthly,
                twuser,
                watchtimeText: calcWatchtime(wt),
                percent: Math.round((1000 * wt) / max) / 10,
            });
            return { embeds: [embed] };
        }
        case "profil": {
            const dcuser = interaction.options.getUser("user") ?? interaction.user;
            const twuser = interaction.options.getString("twitchuser")?.toLowerCase() ?? (await getTwitchName(dcuser.id));
            if (!twuser) return { content: "Du musst dich zuerst registrieren - /link" };
            const [stats, ranks, wt] = await Promise.all([getUserStats(channel, twuser), getUserRanks(channel, twuser), getWatchtime(channel, twuser, "alltime")]);
            if (ranks.xpRank === null && !wt) return { content: "Diesen Nutzer kenne ich nicht." };
            // Profilbild: das Discord-Bild des Nutzers (bei Namenssuche: des verknüpften Discord-Accounts), sonst das des Bots
            let avatarUrl = interaction.client.user.avatarURL({ extension: "png" });
            try {
                if (interaction.options.getString("twitchuser")) {
                    const id = await getDiscordId(twuser);
                    const u = id ? await interaction.client.users.fetch(id) : null;
                    if (u) avatarUrl = u.displayAvatarURL({ extension: "png" });
                } else {
                    avatarUrl = dcuser.displayAvatarURL({ extension: "png" });
                }
            } catch (e) {
                logger.debug(`profil: Discord-Profilbild nicht ladbar: ${e.message}`);
            }
            const embed = profileEmbed({
                avatarUrl,
                twuser,
                level: stats.level,
                points: stats.points,
                percent: Math.round((1000 * stats.xpInLevel) / stats.xpToNext) / 10,
            });
            return { embeds: [embed] };
        }
        case "top10":
            return top10Payload(1);
        case "zitat": {
            const id = interaction.options.getInteger("nummer");
            const quote = id ? await getQuote(channel, id) : await randomQuote(channel);
            if (!quote) {
                return { content: id ? `Zitat #${id} gibt es nicht.` : "Es sind noch keine Zitate hinterlegt." };
            }
            return { embeds: [quoteEmbed({ channel, quote })] };
        }
        case "link": {
            const name = interaction.options.getString("name").toLowerCase();
            const previous = await getTwitchName(interaction.user.id);
            await linkUser(interaction.user.id, name);
            return {
                content: previous
                    ? `Du hast deinen Namen von **${previous}** auf **${name}** geändert.`
                    : `Der Name **${name}** wurde erfolgreich eingetragen`,
            };
        }
        case "unlink": {
            const previous = await getTwitchName(interaction.user.id);
            if (!previous) return { content: "Du hast keinen Twitchnamen hinterlegt, den ich löschen kann." };
            await unlinkUser(interaction.user.id);
            return { content: `Deine Verknüpfung zu **${previous}** wurde gelöscht.` };
        }
        case "info": {
            const dcuser = interaction.options.getUser("user") ?? interaction.user;
            const twuser = await getTwitchName(dcuser.id);
            if (!twuser) return { content: `Der Nutzer ${dcuser.tag} hat keinen Namen hinterlegt.` };
            let age = "unbekannt";
            let fage = "unbekannt";
            try {
                const u = await getUser(channel, twuser);
                if (u) {
                    age = formatSince(u.created_at);
                    const since = await getFollowedAt(channel, u.id);
                    fage = since ? formatSince(since) : "folgt nicht";
                }
            } catch (e) {
                logger.debug(`twitchname: API nicht verfügbar: ${e.message}`);
            }
            const embed = linkingInfoEmbed({
                avatarUrl: dcuser.avatarURL(),
                discordName: dcuser.username,
                twitchName: twuser,
                age,
                followAge: fage,
            });
            return { embeds: [embed] };
        }
        default:
            return { content: "Unbekannter Befehl." };
    }
}
