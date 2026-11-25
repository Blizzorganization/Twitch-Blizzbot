import { config } from "../../config.js";
import { listAutomessages, isAutomessageEnabled, addAutomessage, deleteAutomessage, setAutomessageEnabled, updateAutomessage } from "../../db/automessages.js";
import { P } from "./shared.js";
import { getSetting } from "../../db/channel-settings.js";

/** Automessage */
export const automessageCommands = {
    automessage: {
        perm: P.MODERATOR,
        alias: ["am"],
        desc: "Verwaltet die automatischen Chat-Nachrichten (an/aus, hinzufügen, löschen, auflisten).",
        run: async (ctx) => {
            const P_ = config.bot.prefix;
            const sub = (ctx.args[0] ?? "list").toLowerCase();
            const list = await listAutomessages(ctx.channel);
            switch (sub) {
                case "list":
                case "status": {
                    const on = (await isAutomessageEnabled(ctx.channel)) ? "an" : "aus";
                    const delay = await getSetting(ctx.channel, "automessageDelay");
                    const head = `Automessage ist ${on}${delay ? ` (alle ${delay} Min.)` : " (Abstand im Dashboard auf 0 gestellt)"}.`;
                    if (!list.length) return ctx.say(`${head} Es sind keine Nachrichten hinterlegt.`);
                    return ctx.say(`${head} ` + list.map((m, i) => `${i + 1}${m.standalone ? " (einzeln)" : ""}: ${m.message}`).join(" | "));
                }
                case "add": {
                    const text = ctx.args.slice(1).join(" ").trim();
                    if (!text) return ctx.say(`Nutzung: ${P_}automessage add <Text>`);
                    await addAutomessage(ctx.channel, text);
                    return ctx.say(`${ctx.user}, die Automessage Nr. ${list.length + 1} wurde hinzugefügt.`);
                }
                case "del": {
                    const nr = Number.parseInt(ctx.args[1], 10);
                    if (!nr || !list[nr - 1]) return ctx.say(`Nutzung: ${P_}automessage del <Nr> (siehe ${P_}automessage list)`);
                    await deleteAutomessage(ctx.channel, list[nr - 1].id);
                    return ctx.say(`${ctx.user}, die Automessage Nr. ${nr} wurde entfernt.`);
                }
                case "einzeln": {
                    const nr = Number.parseInt(ctx.args[1], 10);
                    const mode = (ctx.args[2] ?? "").toLowerCase();
                    if (!nr || !list[nr - 1] || !["an", "aus", "on", "off"].includes(mode)) {
                        return ctx.say(`Nutzung: ${P_}automessage einzeln <Nr> an|aus (siehe ${P_}automessage list)`);
                    }
                    const on = mode === "an" || mode === "on";
                    await updateAutomessage(ctx.channel, list[nr - 1].id, { standalone: on });
                    return ctx.say(`${ctx.user}, die Automessage Nr. ${nr} läuft jetzt ${on ? "einzeln mit eigenem Intervall" : "wieder reihum mit den anderen"}.`);
                }
                case "on":
                case "off":
                    await setAutomessageEnabled(ctx.channel, sub === "on");
                    return ctx.say(`Automessage ist jetzt ${sub === "on" ? "eingeschaltet" : "ausgeschaltet"}.`);
                default:
                    return ctx.say(`Nutzung: ${P_}automessage [list|add <Text>|del <Nr>|einzeln <Nr> an|aus|on|off]`);
            }
        },
    },
};
