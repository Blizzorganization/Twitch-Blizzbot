import { addBlacklist, invalidateBlacklistCache, deleteBlacklist, listBlacklist } from "../../db/blacklist.js";
import { P, EMOTES, hooks } from "./shared.js";

/** Moderation: Blacklist */
export const moderationCommands = {
    addbl: {
        perm: P.MODERATOR,
        desc: "Fügt ein Wort/eine Phrase zur Blacklist hinzu (0 = Nachricht löschen, 1-9 = Timeout, 10 = Bann).",
        run: async (ctx) => {
            if (ctx.args.length < 2) return ctx.say("Du musst angeben, welches Wort du mit welcher Aktion versehen willst!");
            let action = Number.parseInt(ctx.args[0], 10);
            if (Number.isNaN(action)) action = 0;
            const word = ctx.args.slice(1).join(" ").toLowerCase();
            try {
                await addBlacklist(ctx.channel, word, action);
            } catch (e) {
                return ctx.say(`Fehler: ${e.message}`);
            }
            invalidateBlacklistCache(ctx.channel);
            ctx.say(`"${word}" wurde in die Blacklist eingetragen ${EMOTES.blacklistAdded}`);
        },
    },

    delbl: {
        perm: P.MODERATOR,
        desc: "Entfernt einen Eintrag wieder von der Blacklist.",
        run: async (ctx) => {
            if (!ctx.args.length) return ctx.say("Du musst angeben, was du von der Blacklist entfernen willst!");
            const word = ctx.args.join(" ").toLowerCase();
            const ok = await deleteBlacklist(ctx.channel, word);
            invalidateBlacklistCache(ctx.channel);
            ctx.say(
                ok
                    ? `"${word}" wurde von der Blacklist entfernt`
                    : `"${word}" ist in keiner Blacklist vorhanden, kann also auch nicht aus der Blacklist entfernt werden.`,
            );
        },
    },

    blacklist: {
        perm: P.MODERATOR,
        desc: "Zeigt die komplette Blacklist an (per Discord-Anbindung oder im Chat).",
        silent: true,
        run: async (ctx) => {
            if (hooks.sendBlacklist) {
                await hooks.sendBlacklist(ctx.channel);
                return ctx.say(`${ctx.user} Blacklist wurde gesendet`);
            }
            const rows = await listBlacklist(ctx.channel);
            ctx.say(rows.length ? "Blacklist: " + rows.map((r) => `${r.word} [${r.action}]`).join(" | ") : "Die Blacklist ist leer.");
        },
    },
};
