import { Console } from "console";
import { existsSync, readdir } from "fs";
import { Transform } from "stream";
import { CustomError } from "./CustomError.js";
import { logger } from "./logger.js";
/**
 * @module functions
 */
/**
 * load commands
 * @param {Map} commandmap a Map to store commands for execution
 * @param {string} commanddir path to command directory relative to project root
 * @param {string[]} helplist
 * @throws {CustomError} missing command directory
 */
export function loadCommands(commandmap, commanddir, helplist = []) {
    const readcommanddir = `./${commanddir}`;
    if (existsSync(readcommanddir)) {
        readdir(`./${readcommanddir}/`, (err, files) => {
            if (err) return logger.error(err);
            files.forEach(async (file) => {
                if (!file.endsWith(".js")) return;
                const command = file.split(".")[0];
                const props = await import(`../${commanddir}/${command}.js`);
                logger.info(`Attempting to load Command ${command}`);
                commandmap.set(command, props);
                if (props.help) helplist.push(command);
                if (!props.alias) return;
                for (const alias of props.alias) {
                    commandmap.set(alias, props);
                }
            });
        });
    } else {
        throw new CustomError("LoadError", `CommandDirectory ${commanddir} does not exist.`);
    }
}
/**
 * @template {import("./discordclient.js").DiscordClient |import("./twitchclient.js").TwitchClient} EE
 * @param {string} eventdir Event directory relative to project root
 * @param {EE} eventemitter an EventEmitter
 * @example loadEvents("events/twitch", client)
 * @throws {CustomError} missing command directory
 */
export function loadEvents(eventdir, eventemitter) {
    const readeventdir = `./${eventdir}`;
    if (existsSync(readeventdir)) {
        readdir(`./${readeventdir}/`, (err, files) => {
            if (err) return logger.error("Error reading discord events directory:", err);
            files.forEach(async (file) => {
                if (!file.endsWith(".js")) return;
                const eventname = file.split(".")[0];
                const { event } = await import(`../${eventdir}/${eventname}.js`);
                // @ts-expect-error -- don't mix event emitters!
                eventemitter.on(eventname, event.bind(null, eventemitter));
            });
        });
    } else {
        throw new CustomError("LoadError", `EventDirectory ${eventdir} does not exist.`);
    }
}
/**
 *
 * @param {number} watchtime raw watchtime as stored in Database
 * @returns {string} Watchtime String
 * @throws {TypeError} Watchtime has to be a Number
 */
export function calcWatchtime(watchtime) {
    if (typeof watchtime !== "number") throw new CustomError("TypeError", "Watchtime has to be a Number");
    const timeTotalMinutes = Math.floor(watchtime / 2);
    const timeMinutes = timeTotalMinutes % 60;
    let timeHours = (timeTotalMinutes % 1440) - timeMinutes;
    let timeDays = timeTotalMinutes - timeMinutes - timeHours;
    timeHours /= 60;
    timeDays /= 1440;
    return `${timeDays} Tag(en), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`;
}
/**
 * @template T
 * @param {T[]} list
 * @returns {T} a random array entry
 * @throws {CustomError} list is not an array
 */
export function getRandom(list) {
    if (!Array.isArray(list)) throw new CustomError("TypeError", "getRandom requires an Array.");
    const index = Math.floor(list.length * Math.random());
    return list[index];
}
/**
 * @returns {string} the current date in the format MM-YYYY
 * @example '08-2021'
 */
export function currentMonth() {
    const date = new Date();
    const mon = date.getMonth() + 1;
    const m = `${mon}`.padStart(2, "0");
    const y = date.getFullYear();
    return `${m}-${y}`;
}

const ts = new Transform({
    transform(chunk, enc, cb) {
        cb(null, chunk);
    },
});
const con = new Console({ stdout: ts });
/**
 * @param  {object | Array} data tabular Data
 * @returns {string} the Data displayed as a table in text form
 */
export function getTable(data) {
    con.table(data);
    return (ts.read() || "").toString();
}
/**
 * @param  {string} str
 * @returns {string} the translated time string
 */
export function time(str) {
    return str
        .replace("years", "Jahren")
        .replace("year", "Jahr")
        .replace("months", "Monaten")
        .replace("month", "Monat")
        .replace("weeks", "Wochen")
        .replace("week", "Woche")
        .replace("days", "Tage")
        .replace("day", "Tag")
        .replace("hours", "Stunden")
        .replace("hour", "Stunde")
        .replace("minutes", "Minuten")
        .replace("minute", "Minute")
        .replace("seconds", "Sekunden")
        .replace("second", "Sekunde")
        .replace("has been following", "folgt")
        .replace("for", "seit")
        .replace("is not following", "ist kein Follower von")
        .replace("does not follow", "ist kein Follower von")
        .replace("404 Page Not Found", "Keine Informationen")
        .replace("User not found", "Finde keinen User mit dem Namen")
        .replace("A user cannot follow themself", "man kann sich nicht selber folgen");
}
