import { PERMISSIONS, permissionFromName } from "../../config.js";
import { logger } from "../../utils/logger.js";

export const P = PERMISSIONS;

/** Emotes/Texte aus dem alten Bot – hier anpassbar */
export const EMOTES = { logo: "blizzorLogo", blacklistAdded: "TPFufun" };

/** Wird von index.js gesetzt (Discord-Anbindung für !blacklist), optional. */
export const hooks = { sendBlacklist: null };

/** Wird von commands.js befüllt, damit einzelne Commands (z. B. !switch) Namen/Aliase auflösen können, ohne zirkulär zu importieren. */
export const registry = { resolveName: () => undefined };

export const bang = (s) => "!" + String(s).trim().replace(/^!+/, "");
export const clean = (s) => String(s).toLowerCase().replace("@", "");

/** Optionale Flags am Anfang eines Textes: -p=mod  -cd=10 */
export function parseFlags(text) {
    const opts = {};
    let rest = text.trim();
    for (;;) {
        const m = rest.match(/^-(p|cd)=(\S+)\s*/i);
        if (!m) break;
        if (m[1].toLowerCase() === "p") opts.permission = permissionFromName(m[2]);
        else {
            const n = Number(m[2]);
            if (Number.isFinite(n) && n >= 0) opts.cooldown = Math.floor(n);
        }
        rest = rest.slice(m[0].length);
    }
    return { opts, text: rest };
}

/** Fängt Fehler der Twitch-API ab und meldet sie freundlich im Chat. */
export function api(fn) {
    return async (ctx) => {
        try {
            await fn(ctx);
        } catch (e) {
            logger.warn(`Twitch-API-Fehler bei !${ctx.name}: ${e.message}`);
            ctx.say(`${ctx.user}, das hat gerade nicht geklappt: ${e.message}`);
        }
    };
}

export const target = (ctx) => clean(ctx.args[0] ?? "") || ctx.user;
