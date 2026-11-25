import { config } from "../../config.js";
import { getSetting } from "../../db/channel-settings.js";
import { P } from "./shared.js";
import { MAX_SECONDS, MAX_PER_CHANNEL, createTimer, activeTimers, cancelTimer, cancelAllTimers } from "../../services/timer.js";

/**
 * Timer und Erinnerungen: `!timer 10m Pause vorbei` schreibt nach Ablauf den Text in den Chat.
 * Die Timer stehen in der Datenbank (services/timer.js) und überleben einen Neustart.
 */
/** "10m", "1h30m", "90s", "1:30" (min:sek) oder nur "5" (= Minuten) -> Sekunden, sonst null. */
export function parseDuration(input) {
    const s = String(input ?? "").trim().toLowerCase();
    if (/^\d+$/.test(s)) return Number(s) * 60;
    const clock = /^(\d+):(\d{1,2})$/.exec(s);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
    if (!m || (!m[1] && !m[2] && !m[3])) return null;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h && `${h} Std.`, m && `${m} Min.`, s && `${s} Sek.`].filter(Boolean).join(" ") || "0 Sek.";
}

export const timerCommands = {
    timer: {
        perm: P.MODERATOR,
        alias: ["erinnerung", "remind"],
        desc: "Erinnerung im Chat: timer <Dauer, z. B. 10m / 1h30m / 90s> <Text>. timer list zeigt alle, timer cancel <Nr> bricht einen ab, timer clear alle.",
        run: async (ctx) => {
            const p = config.bot.prefix;
            const sub = (ctx.args[0] ?? "").toLowerCase();

            if (!sub) return ctx.say(`Nutzung: ${p}timer <Dauer, z. B. 10m> <Text> | ${p}timer list | ${p}timer cancel <Nr> | ${p}timer clear`);

            if (sub === "list") {
                const active = await activeTimers(ctx.channel);
                if (!active.length) return ctx.say("Es läuft kein Timer.");
                const now = Date.now();
                return ctx.say(active.map((t, i) => `${i + 1}: in ${formatDuration(Math.max(0, Math.round((new Date(t.ends_at).getTime() - now) / 1000)))} – ${t.text}`).join(" | "));
            }
            if (sub === "clear") {
                const n = await cancelAllTimers(ctx.channel);
                return ctx.say(n ? `${n} Timer abgebrochen.` : "Es läuft kein Timer.");
            }
            if (sub === "cancel" || sub === "del") {
                const active = await activeTimers(ctx.channel);
                const nr = Number.parseInt(ctx.args[1], 10);
                const t = active[nr - 1];
                if (!t) return ctx.say(`Nutzung: ${p}timer cancel <Nr> (siehe ${p}timer list)`);
                await cancelTimer(t);
                return ctx.say(`Timer ${nr} abgebrochen.`);
            }

            const seconds = parseDuration(sub);
            const text = ctx.args.slice(1).join(" ").trim();
            if (seconds === null || seconds < 1) return ctx.say(`Die Dauer kenne ich nicht. Beispiele: 10m, 1h30m, 90s, 5 (= Minuten). Nutzung: ${p}timer <Dauer> <Text>`);
            if (seconds > MAX_SECONDS) return ctx.say("Ein Timer darf höchstens 24 Stunden dauern.");
            if (!text) return ctx.say(`Du musst angeben, woran erinnert werden soll. Nutzung: ${p}timer <Dauer> <Text>`);
            if ((await activeTimers(ctx.channel)).length >= MAX_PER_CHANNEL) {
                return ctx.say(`Es laufen schon ${MAX_PER_CHANNEL} Timer. Mit ${p}timer cancel <Nr> oder ${p}timer clear räumst du auf.`);
            }

            if (!(await getSetting(ctx.channel, "timersEnabled"))) return ctx.say("Timer sind gerade ausgeschaltet.");
            await createTimer(ctx.channel, ctx.user, text, seconds);
            return ctx.say(`${ctx.user}, Timer gestellt: in ${formatDuration(seconds)} kommt „${text}“.`);
        },
    },
};
