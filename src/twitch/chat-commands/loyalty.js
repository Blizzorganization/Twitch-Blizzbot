import { getUserStats, getUserRanks, topXp, topPoints, grantPoints } from "../../db/leveling.js";
import { getWatchtime, getWatchtimeRank } from "../../db/watchtime.js";
import { config } from "../../config.js";
import { P, clean } from "./shared.js";

/** Watchtime-Einheiten (à 30 s) kompakt: "3d 4h 12m" */
function shortWatchtime(units) {
    const total = Math.floor(units / 2);
    const d = Math.floor(total / 1440), h = Math.floor((total % 1440) / 60), m = total % 60;
    return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

/** Loyalty: Level, Punkte, Ranglisten */
export const loyaltyCommands = {
    level: {
        perm: P.EVERYONE,
        help: true,
        alias: ["rank", "lvl", "xp"],
        desc: "Zeigt dein Level und deinen XP-Fortschritt (oder den eines anderen Nutzers).",
        run: async (ctx) => {
            const user = ctx.args[0] ? clean(ctx.args[0]) : ctx.tags.username;
            const s = await getUserStats(ctx.channel, user);
            ctx.say(`${user} ist Level ${s.level} (${s.xpInLevel}/${s.xpToNext} XP bis zum nächsten Level).`);
        },
    },

    punkte: {
        perm: P.EVERYONE,
        help: true,
        alias: ["points"],
        desc: "Zeigt deinen Punktestand (oder den eines anderen Nutzers).",
        run: async (ctx) => {
            const user = ctx.args[0] ? clean(ctx.args[0]) : ctx.tags.username;
            const s = await getUserStats(ctx.channel, user);
            ctx.say(`${user} hat ${s.points} Punkte.`);
        },
    },

    stats: {
        perm: P.EVERYONE,
        help: true,
        alias: ["profil"],
        desc: "Zeigt Level, Watchtime und Punkte samt Platzierung (deine oder die eines anderen Nutzers).",
        run: async (ctx) => {
            const own = !ctx.args[0];
            const user = own ? ctx.tags.username : clean(ctx.args[0]);
            const [s, ranks, wt, wtRank] = await Promise.all([
                getUserStats(ctx.channel, user),
                getUserRanks(ctx.channel, user),
                getWatchtime(ctx.channel, user, "alltime"),
                getWatchtimeRank(ctx.channel, user),
            ]);
            if (!own && !wt && ranks.xpRank === null) return ctx.say("Diesen Nutzer kenne ich nicht.");
            const place = (n) => (n ? ` (Platz ${n})` : "");
            ctx.say(
                `${user}: Level ${s.level}${place(ranks.xpRank)} · ${wt ? `${shortWatchtime(wt)} Watchtime${place(wtRank)}` : "noch keine Watchtime"} · ${s.points} Punkte${place(ranks.pointsRank)}`,
            );
        },
    },

    top: {
        perm: P.EVERYONE,
        help: true,
        desc: "Top 10 Liste. Nutzung: !top <Coins|XP>",
        run: async (ctx) => {
            const arg = (ctx.args[0] ?? "").toLowerCase();
            if (["xp", "level", "lvl"].includes(arg)) {
                const top = await topXp(ctx.channel, 10);
                if (!top.length) return ctx.say("Noch niemand hat XP gesammelt.");
                return ctx.say(`Aktuelle Top 10 nach Level: ${top.map((r, i) => `${i + 1}. ${r.displayName || r.username} (Lvl ${r.level})`).join(" | ")}`);
            }
            if (["coins", "coin", "punkte", "points"].includes(arg)) {
                const top = await topPoints(ctx.channel, 10);
                if (!top.length) return ctx.say("Noch niemand hat Punkte gesammelt.");
                return ctx.say(`Die Top 10 nach Punkten: ${top.map((r, i) => `${i + 1}. ${r.displayName || r.username} (${r.points})`).join(" | ")}`);
            }
            ctx.say(`Nutzung: ${config.bot.prefix}top xp | coins`);
        },
    },

    givepunkte: {
        perm: P.MODERATOR,
        desc: "Vergibt (oder entzieht mit negativer Zahl) Punkte an einen Nutzer.",
        run: async (ctx) => {
            const user = clean(ctx.args[0] ?? "");
            const amount = Number(ctx.args[1]);
            if (!user || !Number.isFinite(amount)) return ctx.say(`Nutzung: ${config.bot.prefix}givepunkte <nutzer> <anzahl>`);
            const total = await grantPoints(ctx.channel, user, user, Math.floor(amount));
            ctx.say(`${user} hat jetzt ${total} Punkte.`);
        },
    },
};
