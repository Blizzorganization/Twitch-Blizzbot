import { config } from "../../config.js";
import { P, clean } from "./shared.js";
import { parseDuration, formatDuration } from "./timer.js";
import { UserError } from "../../utils/errors.js";
import { permitLinks, revokePermit, DEFAULT_SECONDS, MAX_SECONDS } from "../../services/link-permit.js";

/** Link-Freigabe: `!permit <name> [Dauer|stream]` erlaubt einem Nutzer Links, `!unpermit <name>` nimmt die Freigabe zurück. */
export const permitCommands = {
    permit: {
        perm: P.MODERATOR,
        desc: "Erlaubt einem Nutzer Links: permit <Name> [Dauer, z. B. 10m | stream]. Ohne Dauer 5 Minuten, stream = bis der Stream endet (max. 12 Std.).",
        run: async (ctx) => {
            const p = config.bot.prefix;
            const name = clean(ctx.args[0] ?? "");
            if (!name) return ctx.say(`Nutzung: ${p}permit <Name> [Dauer, z. B. 10m | stream] – ohne Dauer ${formatDuration(DEFAULT_SECONDS)}`);
            const arg = (ctx.args[1] ?? "").toLowerCase();
            let options;
            if (!arg) options = { seconds: DEFAULT_SECONDS };
            else if (arg === "stream") options = { untilOffline: true };
            else {
                const seconds = parseDuration(arg);
                if (seconds === null || seconds < 1) return ctx.say(`Die Dauer kenne ich nicht. Beispiele: 10m, 1h, 90s oder stream. Nutzung: ${p}permit <Name> [Dauer | stream]`);
                if (seconds > MAX_SECONDS) return ctx.say("Eine Freigabe darf höchstens 12 Stunden dauern.");
                options = { seconds };
            }
            let r;
            try {
                r = await permitLinks(ctx.channel, name, ctx.user, options);
            } catch (e) {
                if (e instanceof UserError) return ctx.say(`${ctx.user}: ${e.message}`);
                throw e;
            }
            return ctx.say(r.untilOffline
                ? `@${r.username} darf bis zum Ende des Streams Links posten.`
                : `@${r.username} darf ${formatDuration(r.seconds)} lang Links posten.`);
        },
    },
    unpermit: {
        perm: P.MODERATOR,
        desc: "Nimmt die Link-Freigabe eines Nutzers zurück: unpermit <Name>.",
        run: async (ctx) => {
            const name = clean(ctx.args[0] ?? "");
            if (!name) return ctx.say(`Nutzung: ${config.bot.prefix}unpermit <Name>`);
            return ctx.say((await revokePermit(ctx.channel, name)) ? `@${name} darf keine Links mehr posten.` : `@${name} hatte keine Freigabe.`);
        },
    },
};
