import { getChannelSettings } from "../../db/channel-settings.js";
import { setFollowersMode, setGame, setTitle, apiConfigured, sendShoutout } from "../api.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config.js";
import { setTotalSubs } from "../../db/events.js";
import { startRaidPause } from "../../services/raid-pause.js";
import { P, api, target } from "./shared.js";

/** Stream-Steuerung (Spiel/Titel, Raid, Shoutout, Subs) */
export const streamCommands = {
    raid: {
        perm: P.VIP,
        desc: "Deaktiviert den Follower-Modus vorübergehend (für Raids), aktiviert ihn danach automatisch wieder.",
        run: api(async (ctx) => {
            await startRaidPause(ctx.channel, ctx.say);
        }),
    },

    setgame: {
        perm: P.MODERATOR,
        desc: "Setzt die Spiele-Kategorie des Streams.",
        run: api(async (ctx) => {
            if (!ctx.args.length) return ctx.say(`Nutzung: ${config.bot.prefix}setgame <Kategorie>`);
            const name = await setGame(ctx.channel, ctx.args.join(" "));
            ctx.say(name ? `Kategorie wurde auf "${name}" gesetzt.` : `Keine Kategorie zu "${ctx.args.join(" ")}" gefunden.`);
        }),
    },

    settitle: {
        perm: P.MODERATOR,
        desc: "Setzt den Stream-Titel.",
        run: api(async (ctx) => {
            if (!ctx.args.length) return ctx.say(`Nutzung: ${config.bot.prefix}settitle <Titel>`);
            const title = ctx.args.join(" ");
            await setTitle(ctx.channel, title);
            ctx.say(`Titel wurde auf "${title}" gesetzt.`);
        }),
    },

    shoutout: {
        perm: P.MODERATOR,
        alias: ["so"],
        desc: "Gibt einem anderen Kanal ein Shoutout (mit Twitchs eigener Shoutout-Funktion, wenn verfügbar).",
        run: async (ctx) => {
            if (!ctx.args.length) return ctx.say("Du musst einen Namen angeben.");
            const user = ctx.args[0].replace("@", "");
            // Nutzt Twitchs eigene Shoutout-Funktion (Scope moderator:manage:shoutouts), damit der Kanal
            // mit Vorschaubild im Chat erscheint; ohne passenden Scope/Token nur die Chat-Nachricht wie bisher.
            if (apiConfigured()) {
                try {
                    const target = await sendShoutout(ctx.channel, user);
                    if (target) {
                        return ctx.say(`Kleines Shoutout an ${target.display_name} schaut doch auch mal bei https://www.twitch.tv/${user.toLowerCase()} vorbei`);
                    }
                    return ctx.say(`Finde keinen Twitch-Nutzer mit dem Namen ${user}.`);
                } catch (e) {
                    logger.warn(`Shoutout in ${ctx.channel} über die Twitch-API fehlgeschlagen (${e.message}) – sende nur Chat-Text.`);
                }
            }
            ctx.say(`Kleines Shoutout an ${user} schaut doch auch mal bei https://www.twitch.tv/${user.toLowerCase()} vorbei`);
        },
    },

    setsubs: {
        perm: P.BROADCASTER,
        desc: "Setzt den Zähler für verschenkte Subs auf einen festen Wert.",
        run: async (ctx) => {
            const n = Number(ctx.args[0]);
            if (!Number.isInteger(n) || n < 0) return ctx.say(`Nutzung: ${config.bot.prefix}setsubs <Zahl>`);
            await setTotalSubs(ctx.channel, n);
            ctx.say(`Verschenkte Subs wurden auf ${n} gesetzt.`);
        },
    },
};
