import { addQuote, deleteQuote, getQuote, randomQuote } from "../../db/quotes.js";
import { logAudit } from "../../db/audit.js";
import { P } from "./shared.js";

/** Zitate */
export const quotesCommands = {
    zitat: {
        perm: P.EVERYONE,
        help: true,
        alias: ["quote", "zitate", "quotes"],
        // !zitat selbst ist für alle (zeigt ein zufälliges Zitat), die Unterbefehle sind aber einzeln
        // aufgeführt, weil add/remove intern auf Moderatoren beschränkt sind (siehe run()) - tauchen
        // deshalb zusätzlich als eigene Zeilen unter "Botcommands" auf.
        modRows: [
            { usage: "add <Text>", desc: "Legt ein neues Zitat an." },
            { usage: "remove <ID>", desc: "Löscht ein Zitat anhand seiner Nummer." },
            { usage: "<ID>", desc: "Zeigt ein bestimmtes Zitat anhand seiner Nummer an.", perm: "everyone" },
        ],
        run: async (ctx) => {
            const sub = ctx.args[0]?.toLowerCase();

            if (sub === "add" || sub === "hinzufügen" || sub === "hinzufuegen") {
                if (ctx.permission < P.MODERATOR) return ctx.say("Zitate hinzufügen dürfen nur Moderatoren.");
                const text = ctx.args.slice(1).join(" ").trim();
                if (!text) return ctx.say("Du musst einen Text angeben: !zitat add <Text>");
                const q = await addQuote(ctx.channel, text, ctx.user);
                logAudit({ actor: `${ctx.user} (Twitch)`, action: "create", targetType: "quote", target: String(q.id), channel: ctx.channel, details: { text } });
                return ctx.say(`Zitat #${q.id} wurde hinzugefügt.`);
            }

            if (sub === "remove" || sub === "del" || sub === "delete" || sub === "löschen" || sub === "loeschen") {
                if (ctx.permission < P.MODERATOR) return ctx.say("Zitate löschen dürfen nur Moderatoren.");
                const id = Number(ctx.args[1]);
                if (!Number.isInteger(id)) return ctx.say("Du musst eine gültige Zitat-ID angeben: !zitat remove <ID>");
                const ok = await deleteQuote(ctx.channel, id);
                if (ok) logAudit({ actor: `${ctx.user} (Twitch)`, action: "delete", targetType: "quote", target: String(id), channel: ctx.channel });
                return ctx.say(ok ? `Zitat #${id} wurde gelöscht.` : `Zitat #${id} gibt es nicht.`);
            }

            if (sub !== undefined && /^\d+$/.test(sub)) {
                const q = await getQuote(ctx.channel, Number(sub));
                return ctx.say(q ? `Zitat #${q.id}: "${q.text}"` : `Zitat #${sub} gibt es nicht.`);
            }

            const q = await randomQuote(ctx.channel);
            ctx.say(q ? `Zitat #${q.id}: "${q.text}"` : "Es sind noch keine Zitate hinterlegt. Mit !zitat add <Text> ein neues anlegen.");
        },
    },
};
