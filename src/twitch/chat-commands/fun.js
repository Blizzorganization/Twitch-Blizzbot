import { getTwitchEmotes, getBttvEmotes, getSevenTvEmotes } from "../api.js";
import { config } from "../../config.js";
import { P, api } from "./shared.js";

/** Spaß-Commands */
export const funCommands = {
    dice: {
        perm: P.EVERYONE,
        help: true,
        run: (ctx) => ctx.say(`Du hast eine ${1 + Math.floor(Math.random() * 6)} gewürfelt.`),
    },

    emote: {
        perm: P.EVERYONE,
        help: true,
        alias: ["emotes"],
        run: api(async (ctx) => {
            const platform = (ctx.args[0] ?? "").toLowerCase();
            const fetchers = {
                sub: { label: "Twitch-Sub", fn: getTwitchEmotes },
                twitch: { label: "Twitch-Sub", fn: getTwitchEmotes },
                bttv: { label: "BTTV", fn: getBttvEmotes },
                bettertwitchtv: { label: "BTTV", fn: getBttvEmotes },
                "7tv": { label: "7TV", fn: getSevenTvEmotes },
                seventv: { label: "7TV", fn: getSevenTvEmotes },
            };
            const entry = fetchers[platform];
            if (!entry) return ctx.say(`Nutzung: ${config.bot.prefix}emote Sub | bttv | 7tv`);
            const emotes = await entry.fn(ctx.channel);
            if (!emotes.length) return ctx.say(`Auf diesem Kanal sind keine ${entry.label}-Emotes verfügbar`);
            ctx.say(`${entry.label}-Emotes auf ${ctx.channel}: ${emotes.slice(0, 40).join(" ")}`);
        }),
    },
};
