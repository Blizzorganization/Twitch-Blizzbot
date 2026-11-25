/** Dashboard-Routen: Allgemeine Angaben (Kanäle, Berechtigungen) */
import { config, PERMISSION_NAMES } from "../../config.js";
import { getUserChannels } from "../../db/user-channels.js";
import { wrap } from "../context.js";

const BLACKLIST_LABELS = {
    0: "Nachricht löschen", 1: "Timeout 10 s", 2: "Timeout 30 s", 3: "Timeout 42 s", 4: "Timeout 1 min",
    5: "Timeout 5 min", 6: "Timeout 10 min", 7: "Timeout 20 min", 8: "Timeout 30 min", 9: "Timeout 1 h", 10: "Bann",
};

export function registerMeta(api) {
    api.get("/meta", wrap(async (req, res) => {
        const own = req.user.id === 0 ? [] : await getUserChannels(req.user.id);
        const channels = own.length ? own.filter((c) => config.twitch.channels.includes(c)) : config.twitch.channels;
        res.json({ channels, permissions: PERMISSION_NAMES, prefix: config.bot.prefix, blacklistActions: BLACKLIST_LABELS });
    }));
    // Immer ALLE konfigurierten Kanäle (unabhängig von eigenen Rechten) – für die Kanalauswahl im Benutzer-Tab
    api.get("/all-channels", wrap(async (req, res) => res.json({ channels: config.twitch.channels })));
}
