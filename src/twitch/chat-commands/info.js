import { getUser, getFollowedAt, getStream, getChannelInfo, getFollowerCount, getSubscriberInfo } from "../api.js";
import { formatSince, calcWatchtime } from "../../utils/time.js";
import { logger } from "../../utils/logger.js";
import { getWatchtime, currentMonth } from "../../db/watchtime.js";
import { P, EMOTES, clean, api, target } from "./shared.js";

/** Info-Commands (Zuschauer-Auskünfte) */
export const infoCommands = {
    age: {
        perm: P.EVERYONE,
        help: true,
        alias: ["alter"],
        run: api(async (ctx) => {
            const name = target(ctx);
            const u = await getUser(ctx.channel, name);
            if (!u) return ctx.say(`Finde keinen User mit dem Namen ${name}`);
            ctx.say(`Der Account ${name} wurde vor ${formatSince(u.created_at)} erstellt.`);
        }),
    },

    fage: {
        perm: P.EVERYONE,
        help: true,
        alias: ["folgezeit", "followage"],
        run: api(async (ctx) => {
            const name = target(ctx);
            if (name.toLowerCase() === ctx.channel) return ctx.say("Man kann sich nicht selber folgen");
            const u = await getUser(ctx.channel, name);
            if (!u) return ctx.say(`Finde keinen User mit dem Namen ${name}`);
            const since = await getFollowedAt(ctx.channel, u.id);
            if (!since) return ctx.say(`${name} folgt dem Kanal nicht`);
            ctx.say(`${name} folgt ${ctx.channel} schon: ${formatSince(since)}`);
        }),
    },

    uptime: {
        perm: P.EVERYONE,
        help: true,
        run: api(async (ctx) => {
            const stream = await getStream(ctx.channel);
            if (!stream) return ctx.say(`${ctx.channel} ist offline.`);
            ctx.say(`${ctx.channel} ist seit ${formatSince(stream.started_at)} live. ${EMOTES.logo}`);
        }),
    },

    game: {
        perm: P.EVERYONE,
        help: true,
        alias: ["spiel"],
        run: api(async (ctx) => {
            const info = await getChannelInfo(ctx.channel);
            ctx.say(`${ctx.channel} spielt gerade: ${info?.game_name || "-"}`);
        }),
    },

    title: {
        perm: P.EVERYONE,
        help: true,
        alias: ["titel"],
        run: api(async (ctx) => {
            const info = await getChannelInfo(ctx.channel);
            ctx.say(`Der Titel des Streams lautet: ${info?.title ?? "-"}`);
        }),
    },

    info: {
        perm: P.EVERYONE,
        help: true,
        run: api(async (ctx) => {
            const follows = await getFollowerCount(ctx.channel);
            let subs = "?";
            let points = "?";
            try {
                const s = await getSubscriberInfo(ctx.channel);
                subs = s.total;
                points = s.points;
            } catch (e) {
                logger.debug(`Sub-Infos nicht verfügbar (Scope channel:read:subscriptions?): ${e.message}`);
            }
            ctx.say(`${ctx.channel} hat zur Zeit ${follows} Follower, ${subs} Subscriber und ${points} Subpoints`);
        }),
    },

    watchtime: {
        perm: P.EVERYONE,
        help: true,
        alias: ["wt"],
        run: async (ctx) => {
            let user = ctx.args[0] ? clean(ctx.args[0]) : undefined;
            let wt;
            if (user) {
                wt = await getWatchtime(ctx.channel, user, "alltime");
                if (!wt) return ctx.say("Diesen Nutzer kenne ich nicht.");
            } else {
                user = ctx.tags.username;
                wt = (await getWatchtime(ctx.channel, user, "alltime")) || 1;
            }
            ctx.say(`${user} schaut ${ctx.channel} schon seit ${calcWatchtime(wt)}`);
        },
    },

    mtime: {
        perm: P.MODERATOR,
        desc: "Zeigt die Watchtime eines anderen Nutzers in diesem Monat an.",
        run: async (ctx) => {
            let user = ctx.args[0] ? clean(ctx.args[0]) : undefined;
            let wt;
            if (user) {
                wt = await getWatchtime(ctx.channel, user, currentMonth());
                if (!wt) return ctx.say("Diesen Nutzer kenne ich nicht.");
            } else {
                user = ctx.tags.username;
                wt = (await getWatchtime(ctx.channel, user, currentMonth())) || 1;
            }
            ctx.say(`${user} schaut ${ctx.channel} diesen Monat schon seit ${calcWatchtime(wt)}`);
        },
    },
};
