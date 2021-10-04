const { CustomError } = require("./CustomError");
const { existsSync, readdir } = require("fs");
const Logger = require("./logger");
/**
 * @module functions
 */
/**
 * load commands
 * @param {Map} commandmap a Map to store commands for execution
 * @param {string} commanddir path to command directory relative to project root
 * @param {string[]} helplist
 * @throws {LoadError} missing command directory
 */
exports.loadCommands = (commandmap, commanddir, helplist = []) => {
    const readcommanddir = "./" + commanddir;
    if (existsSync(readcommanddir)) {
        readdir(`./${readcommanddir}/`, (err, files) => {
            if (err) return Logger.error(err);
            files.forEach(file => {
                if (!(file.endsWith(".js"))) return;
                const command = file.split(".")[0];
                const props = require(`../${commanddir}/${command}`);
                Logger.log("command", `Attempting to load Command ${command}`);
                commandmap.set(command, props);
                if (props.help && helplist) helplist.push(command);
                if (!props.alias) return;
                for (const alias of props.alias) {
                    commandmap.set(alias, props);
                }
            });
        });
    } else {throw new CustomError("LoadError", `CommandDirectory ${commanddir} does not exist.`);}
};
/**
 *
 * @param {string} eventdir Event directory relative to project root
 * @param {import("./discordclient").DiscordClient | import("./twitchclient").TwitchClient} eventemitter an EventEmitter
 * @example loadEvents("events/twitch", client)
 * @throws {LoadError} missing command directory
 */
exports.loadEvents = (eventdir, eventemitter) => {
    const readeventdir = "./" + eventdir;
    if (existsSync(readeventdir)) {
        readdir(`./${readeventdir}/`, (err, files) => {
            if (err) return Logger.error("Error reading discord events directory:", err);
            files.forEach(file => {
                if (!(file.endsWith(".js"))) return;
                const eventname = file.split(".")[0];
                const { event } = require(`../${eventdir}/${eventname}`);
                // @ts-ignore
                eventemitter.on(eventname, event.bind(null, eventemitter));
            });
        });
    } else {throw new CustomError("LoadError", `EventDirectory ${eventdir} does not exist.`);}
};
/**
 *
 * @param {number} watchtime raw watchtime as stored in Database
 * @returns {string} Watchtime String
 * @throws {TypeError} Watchtime has to be a Number
 */
exports.calcWatchtime = (watchtime) => {
    if (typeof watchtime !== "number") throw new CustomError("TypeError", "Watchtime has to be a Number");
    const timeTotalMinutes = Math.floor(watchtime / 2);
    const timeMinutes = timeTotalMinutes % 60;
    let timeHours = (timeTotalMinutes % 1440) - timeMinutes;
    let timeDays = (timeTotalMinutes - timeMinutes) - timeHours;
    timeHours /= 60;
    timeDays /= 1440;
    return `${timeDays} Tag(en), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`;
};
exports.getRandom = (list) => {
    if (!Array.isArray(list)) throw new CustomError("TypeError", "getRandom erfordert ein Array.");
    const index = Math.floor(list.length * Math.random());
    return list[index];
};
/**
 * @returns {string}
 * @example '08-2021'
 */
exports.currentMonth = () => {
    const date = new Date();
    const mon = date.getMonth() + 1;
    const m = mon > 9 ? `${mon}` : `0${mon}`;
    const y = date.getFullYear();
    return `${m}-${y}`;
};
const { Console } = require("console");
const { Transform } = require("stream");

const ts = new Transform({ transform(chunk, enc, cb) { cb(null, chunk); } });
const logger = new Console({ stdout: ts });

exports.getTable = function getTable(data) {
    logger.table(data);
    return (ts.read() || "").toString();
};