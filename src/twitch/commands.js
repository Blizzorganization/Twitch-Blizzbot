import { listInternalStates, listCommandNames, getInternalState } from "../db/commands.js";
import { P, registry } from "./chat-commands/shared.js";
import { infoCommands } from "./chat-commands/info.js";
import { funCommands } from "./chat-commands/fun.js";
import { loyaltyCommands } from "./chat-commands/loyalty.js";
import { streamCommands } from "./chat-commands/stream.js";
import { customCommandsCommands } from "./chat-commands/custom-commands.js";
import { countersCommands } from "./chat-commands/counters.js";
import { quotesCommands } from "./chat-commands/quotes.js";
import { moderationCommands } from "./chat-commands/moderation.js";
import { automessageCommands } from "./chat-commands/automessage.js";
import { timerCommands } from "./chat-commands/timer.js";
import { permitCommands } from "./chat-commands/permit.js";
import { adminCommands } from "./chat-commands/admin.js";

// Von außen weiterhin über diese Datei erreichbar (siehe index.js)
export { EMOTES, hooks, parseFlags } from "./chat-commands/shared.js";

/**
 * Alle eingebauten Chat-Commands, thematisch aufgeteilt in ./chat-commands/*.js.
 * Struktur wie im alten Bot: perm, help (in !help gelistet), alias, silent, run
 */
const groups = { ...infoCommands, ...funCommands, ...loyaltyCommands, ...streamCommands, ...customCommandsCommands, ...countersCommands, ...quotesCommands, ...moderationCommands, ...automessageCommands, ...timerCommands, ...permitCommands, ...adminCommands };

const helpCommands = {
    help: {
        perm: P.EVERYONE,
        alias: ["befehle", "command", "commands", "cmd", "cmds"],
        run: async (ctx) => {
            // Ausgeschaltete eingebaute Commands (Dashboard oder !switch) nicht in der Liste anzeigen.
            const disabled = new Set((await listInternalStates(ctx.channel)).filter((r) => !r.enabled).map((r) => r.command));
            const internal = Object.entries(commands)
                .filter(([name, c]) => c.help && !disabled.has(name))
                .map(([name]) => name)
                .sort();
            const custom = await listCommandNames(ctx.channel, P.EVERYONE);
            const all = [...internal.map((n) => `!${n}`), ...custom];
            if (!all.length) return ctx.say("Aktuell ist kein Command hinterlegt");
            ctx.say(`Der Bot kann folgende Commands: ${all.join(", ")}`);
        },
    },
};

const all = { ...groups, ...helpCommands };
/** Reihenfolge wie bisher (wirkt sich z. B. auf die Anzeige im Dashboard aus). */
const ORDER = ["age","fage","uptime","game","title","info","watchtime","mtime","dice","level","punkte","stats","top","givepunkte","emote","raid","rename","setgame","settitle","add","madd","edit","medit","del","mdel","recmd","addalias","delalias","addcounter","delcounter","editcounter","counter","counters","zitat","addbl","delbl","blacklist","help","ccmd","aliase","shoutout","switch","transfer","setsubs","automessage","timer","permit","unpermit"];
export const commands = Object.fromEntries(ORDER.map((n) => [n, all[n]]));

/* ------------------------- Namens-/Alias-Nachschlagetabelle ------------------------- */

const lookup = new Map();
for (const [name, cmd] of Object.entries(commands)) {
    cmd.name = name;
    lookup.set(name, cmd);
    for (const a of cmd.alias ?? []) lookup.set(a, cmd);
}

/** Findet einen eingebauten Command über Name oder Alias. */
export const findInternal = (name) => lookup.get(name);

/** Kanonischer Name (z. B. "alter" -> "age") oder undefined */
export const resolveName = (name) => lookup.get(name)?.name;
registry.resolveName = resolveName;

export { getInternalState };

