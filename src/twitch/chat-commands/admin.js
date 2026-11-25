import { getWatchtime, renameWatchtimeUser } from "../../db/watchtime.js";
import { getInternalState, setInternalEnabled } from "../../db/commands.js";
import { P, registry } from "./shared.js";

/** Bot-Verwaltung (Standard-Commands schalten, Watchtime-Namen) */
export const adminCommands = {
    rename: {
        perm: P.DEV,
        desc: "Überträgt die eigene gesammelte Watchtime von einem alten Accountnamen auf den aktuellen.",
        run: async (ctx) => {
            if (!ctx.args.length) return ctx.say("Du musst einen neuen Namen angeben.");
            const oldName = ctx.args[0].toLowerCase();
            const newName = ctx.tags.username;
            if (await getWatchtime(ctx.channel, newName, "alltime")) {
                return ctx.say(
                    "Dieser Nutzer hat bereits watchtime gesammelt. Wenn du die watchtime dieses Accounts trotzdem übertragen möchtest, wende dich bitte an eine:n Moderator:in",
                );
            }
            await renameWatchtimeUser(ctx.channel, oldName, newName);
            ctx.say(`Deine Watchtime wurde erfolgreich von ${oldName} umgeschrieben.`);
        },
    },

    switch: {
        perm: P.MODERATOR,
        desc: "Schaltet einen Standard-Befehl ein oder aus (wie der Schalter im Dashboard unter \"Botcommands\"/\"Standard Befehle\").",
        run: async (ctx) => {
            if (!ctx.args.length) return ctx.say("Du musst einen Befehl angeben.");
            const typed = ctx.args[0].toLowerCase().replace(/^!/, "");
            const name = registry.resolveName(typed);
            if (!name) return ctx.say("Diesen Befehl gibt es nicht.");
            if (name === "switch" || name === "help") return ctx.say(`Der Befehl !${name} kann nicht deaktiviert werden.`);
            const state = await getInternalState(ctx.channel, name);
            if (state) {
                await setInternalEnabled(ctx.channel, name, !state.enabled);
                return ctx.say(`Der Befehl !${name} ist jetzt ${state.enabled ? "ausgeschaltet" : "eingeschaltet"}.`);
            }
            await setInternalEnabled(ctx.channel, name, false);
            ctx.say(`Der Befehl !${name} ist jetzt deaktiviert.`);
        },
    },
};
