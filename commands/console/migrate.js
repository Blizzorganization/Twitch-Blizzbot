const sqlite = require("better-sqlite3");
const { readdirSync, existsSync } = require("fs");
const enmap = require("enmap");
/**
 * @name eval
 * @namespace ConsoleCommands
 * @param {import("../../modules/clients").Clients} clients 
 * @param {string[]} args 
 */
exports.run = async (clients, args) => {
    let modes = ["watchtime", "customcommands", "blacklist"];
    if (!args || (args.length !== 4 && args.length !== 2)) return clients.logger.error("Du musst den Modus (watchtime/customcommands/blacklist), die Datenbank (muss im data Verzeichnis liegen), den zugehörigen Kanal und bei customcommands die Berechtigung (user/mod) sowie bei watchtime den Zeitraum ('alltime' oder MM-YYYY)");
    if (!modes.includes(args[0].toLowerCase())) return clients.logger.error("Mögliche Optionen sind watchtime , blacklist und customcommands");
    if (args[0] === "blacklist") {
        let channel = args[1].toLowerCase();
        if (!(await clients.db.getChannel(channel))) return clients.logger.error("Diesen Kanal kenne ich nicht.");
        /** @type {enmap.default}*/
        //@ts-ignore
        let em = new enmap({ name: "blacklist" });
        let bldata = em.get("delmsg");
        clients.twitch.blacklist[channel] = bldata;
        await clients.db.saveBlacklist();
        clients.logger.log("info", "Blacklist Migration erfolgreich.");
        return;
    }
    let dbname = args[1];
    if (!existsSync(`data/${dbname}`)) return clients.logger.error("Diese Datenbank existiert nicht.");
    let db = new sqlite(`data/${dbname}`, { readonly: true });
    let channel = args[2].toLowerCase();
    try {
        if (!(await clients.db.getChannel(channel))) return clients.logger.error("Diesen Kanal kenne ich nicht.");
        switch (args[0].toLowerCase()) {
            case "watchtime":
                var month = args[3]?.toLowerCase();
                if (!/((\d)[2]-(\d){4}|(alltime))/.test(month)) return clients.logger.error("Dies ist kein valider Monat.");
                var watchtimeData = db.prepare("SELECT * FROM " + channel + ";").all();
                await clients.db.migrateWatchtime(channel, watchtimeData, month);
                clients.logger.log("info", "Watchtime Migration erfolgreich.");
                break;
            case "customcommands":
                var cmdtype = args[3]?.toLowerCase();
                if (cmdtype !== "mod" && cmdtype !== "user") return clients.logger.error("Du musst angeben ob du die USER oder MOD commands migrieren möchtest.");
                var tblname = cmdtype === "mod" ? "coms" : "ccmds";
                var commandData = db.prepare("SELECT * FROM " + tblname + ";").all();
                await clients.db.migrateCustomcommands(commandData, channel, cmdtype);
                clients.logger.log("info", "Customcommand Migration erfolgreich.");
                break;
            default:
                clients.logger.error("wtf");
                break;
        }
    } finally { db.close(); }
};
/**
 * @param  {import("../../modules/clients").Clients} clients
 * @param  {string} line
 */
exports.completer = (clients, line) => {
    let modes = ["watchtime", "customcommands", "blacklist"];
    let hits;
    let args = line.split(" ");
    switch (args.length) {
        case 2:
            var testMode = args[1];
            hits = modes.filter((c) => c.startsWith(testMode));
            break;
        case 3:
            // eslint-disable-next-line no-sparse-arrays
            if (args[2].toLowerCase() === "blacklist") return [, line];
            if (!existsSync("./data/")) {
                hits = [`${args[1]} data_directory_does_not_exist`];
            } else {
                var files = readdirSync("data");
                hits = files.filter((f) => f.startsWith(args[2]));
                hits.forEach((val, key) => {
                    hits[key] = `${args[1]} ${val}`;
                });
            }
            break;
        default:
            clients.logger.log("received unhandled number of arguments: ", args.length);
            args.shift();
            hits = [args.join(" ")];
    }
    hits.forEach((val, key) => {
        hits[key] = `migrate ${val}`;
    });
    return [hits, line];
};