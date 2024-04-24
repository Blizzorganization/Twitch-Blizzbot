import sqlite from "better-sqlite3";
import Enmap from "enmap";
import { existsSync, readdirSync } from "fs";
import { logger } from "twitch-blizzbot/logger";

/**
 * @name migrate
 * @namespace ConsoleCommands
 * @param {import("twitch-blizzbot/clients").Clients} clients
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function run(clients, args) {
    const modes = ["watchtime", "customcommands", "blacklist"];
    if (!args || (args.length !== 4 && args.length !== 2)) {
        logger.error(
            "Du musst den Modus (watchtime/customcommands/blacklist), die Datenbank (muss im data Verzeichnis liegen), den zugehörigen Kanal und bei customcommands die Berechtigung (user/mod) sowie bei watchtime den Zeitraum ('alltime' oder MM-YYYY)",
        );
        return;
    }
    if (!modes.includes(args[0].toLowerCase())) {
        logger.error("Mögliche Optionen sind watchtime , blacklist und customcommands");
        return;
    }
    if (args[0] === "blacklist") {
        const channel = args[1].toLowerCase();
        if (!(await clients.db.getChannel(channel))) {
            logger.error("Diesen Kanal kenne ich nicht.");
            return;
        }
        /** @type {import("enmap").default}*/
        const em = new Enmap({ name: "blacklist" });
        const bldata = em.get("delmsg");
        clients.twitch.blacklist[channel] = bldata;
        await clients.db.newBlacklistWords(channel, bldata, 0);
        logger.info("Blacklist Migration erfolgreich.");
        return;
    }
    const dbname = args[1];
    if (!existsSync(`data/${dbname}`)) {
        logger.error("Diese Datenbank existiert nicht.");
        return;
    }
    const db = new sqlite(`data/${dbname}`, { readonly: true });
    const channel = args[2].toLowerCase();
    try {
        if (!(await clients.db.getChannel(channel))) {
            logger.error("Diesen Kanal kenne ich nicht.");
            return;
        }
        switch (args[0].toLowerCase()) {
            case "watchtime":
                {
                    const month = args[3]?.toLowerCase();
                    if (!/((\d){2}-(\d){4}|(alltime))/.test(month)) {
                        logger.error("Dies ist kein valider Monat.");
                        return;
                    }
                    /** @type {{watchtime: number, user: string}[]} */
                    const watchtimeData = db.prepare(`SELECT * FROM ${channel};`).all();
                    await clients.db.migrateWatchtime(channel, watchtimeData, month);
                    logger.info("Watchtime Migration erfolgreich.");
                }
                break;
            case "customcommands":
                {
                    const cmdtype = args[3]?.toLowerCase();
                    if (cmdtype !== "mod" && cmdtype !== "user") {
                        logger.error("Du musst angeben ob du die USER oder MOD commands migrieren möchtest.");
                        return;
                    }
                    const tblname = cmdtype === "mod" ? "coms" : "ccmds";
                    const commandData = db.prepare(`SELECT * FROM ${tblname};`).all();
                    await clients.db.migrateCustomcommands(commandData, channel, cmdtype);
                    logger.info("Customcommand Migration erfolgreich.");
                }
                break;
            default:
                logger.error("wtf");
                break;
        }
    } finally {
        db.close();
    }
}

/**
 * @param  {import("twitch-blizzbot/clients").Clients} clients
 * @param  {string} line
 * @returns {[string[], string]} the completion
 */
export function completer(clients, line) {
    const modes = ["watchtime", "customcommands", "blacklist"];
    let hits;
    const args = line.split(" ");
    switch (args.length) {
        case 2:
            {
                const testMode = args[1];
                hits = modes.filter((c) => c.startsWith(testMode));
            }
            break;
        case 3:
            // eslint-disable-next-line no-sparse-arrays
            if (args[2].toLowerCase() === "blacklist") return [, line];
            if (!existsSync("./data/")) {
                hits = [`${args[1]} data_directory_does_not_exist`];
            } else {
                const files = readdirSync("data");
                hits = files.filter((f) => f.startsWith(args[2]));
                hits.forEach((val, key) => {
                    hits[key] = `${args[1]} ${val}`;
                });
            }
            break;
        default:
            logger.warn(`received unhandled number of arguments: ${args.length}`);
            args.shift();
            hits = [args.join(" ")];
    }
    hits.forEach((val, key) => {
        hits[key] = `migrate ${val}`;
    });
    return [hits, line];
}
