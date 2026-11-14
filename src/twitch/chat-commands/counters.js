import { newCounter, delCounter, readCounter, editCounter, setCounter, allCounters } from "../../db/counters.js";
import { logAudit } from "../../db/audit.js";
import { P } from "./shared.js";

/** Zähler */
export const countersCommands = {
    addcounter: {
        perm: P.MODERATOR,
        desc: "Legt einen neuen Zähler an (optional mit Schrittweite und Startwert).",
        run: async (ctx) => {
            const [name, increase, start] = ctx.args;
            if (!name) {
                return ctx.say("Du musst angeben, welchen Zähler (mit optionaler Steigung und einem Startwert) du hinzufügen möchtest.");
            }
            const inc = Number.parseInt(increase, 10);
            const val = Number.parseInt(start, 10);
            const ok = await newCounter(ctx.channel, name, Number.isNaN(inc) ? 1 : inc, Number.isNaN(val) ? 0 : val);
            if (ok) logAudit({ actor: `${ctx.user} (Twitch)`, action: "create", targetType: "counter", target: name.toLowerCase(), channel: ctx.channel });
            ctx.say(ok ? `${ctx.user}, der Zähler ${name.toLowerCase()} wurde hinzugefügt.` : "Diesen Zähler gibt es bereits.");
        },
    },

    delcounter: {
        perm: P.MODERATOR,
        desc: "Löscht einen Zähler.",
        run: async (ctx) => {
            if (!ctx.args[0]) return ctx.say("Du musst angeben, welchen Zähler du löschen möchtest.");
            await delCounter(ctx.channel, ctx.args[0]);
            logAudit({ actor: `${ctx.user} (Twitch)`, action: "delete", targetType: "counter", target: ctx.args[0].toLowerCase(), channel: ctx.channel });
            ctx.say(`${ctx.user}, der Zähler ${ctx.args[0].toLowerCase()} wurde entfernt.`);
        },
    },

    editcounter: {
        perm: P.MODERATOR,
        desc: "Ändert den aktuellen Wert oder die Schrittweite eines Zählers.",
        run: async (ctx) => {
            if (ctx.args.length !== 3) {
                return ctx.say(
                    "Du musst angeben, welchen Zähler du bearbeiten willst, ob du den Wert oder die Erhöhung ändern willst und auf welchen Wert du dies anpassen willst.",
                );
            }
            const [name, field, value] = ctx.args;
            if (typeof (await readCounter(ctx.channel, name)) !== "number") return ctx.say(`Ich kenne keinen Zähler ${name}.`);
            const num = Number.parseInt(value, 10);
            if (Number.isNaN(num)) return ctx.say("Dein Letztes Argument muss eine Ganzzahl sein.");
            switch (field.toLowerCase()) {
                case "inc":
                case "increase":
                case "erhöhung":
                    await editCounter(ctx.channel, name, num);
                    break;
                case "val":
                case "value":
                case "wert":
                    await setCounter(ctx.channel, name, num);
                    break;
                default:
                    return ctx.say("Mögliche Aktionen sind `val` und `inc`.");
            }
            logAudit({ actor: `${ctx.user} (Twitch)`, action: "edit", targetType: "counter", target: name.toLowerCase(), channel: ctx.channel, details: { field: field.toLowerCase(), value: num } });
            ctx.say(`${ctx.user}, der Zähler ${name} wurde editiert.`);
        },
    },

    counter: {
        perm: P.MODERATOR,
        desc: "Zeigt den aktuellen Wert eines Zählers im Chat an.",
        run: async (ctx) => {
            if (ctx.args.length < 1) return ctx.say("Du musst angeben, Welche Counter du auslesen möchtest.");
            const name = ctx.args[0].replace("!", "");
            const value = await readCounter(ctx.channel, name);
            if (typeof value !== "number") return ctx.say("Es gibt keinen Counter mit dem Namen.");
            ctx.say(`${ctx.user}, der Counter ${name} hat aktuell den Wert von ${value}.`);
        },
    },

    counters: {
        perm: P.MODERATOR,
        desc: "Listet alle angelegten Zähler auf.",
        run: async (ctx) => {
            const list = await allCounters(ctx.channel);
            ctx.say(list.length ? `Es sind folgende Zähler hinterlegt: ${list.map((c) => c.name).join(", ")}` : "Es sind keine Zähler hinterlegt.");
        },
    },
};
