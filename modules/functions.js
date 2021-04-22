const { CustomError } = require("./CustomError")
const {existsSync, readdir} = require("fs")
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
exports.loadCommands = (commandmap, commanddir, helplist) => {
    var readcommanddir = "./" + commanddir
    if (existsSync(readcommanddir)) {
        readdir(`./${readcommanddir}/`, (err, files) => {
            if (err) return console.error(err);
            files.forEach(file => {
                if (!(file.endsWith(".js"))) return;
                let command = file.split(".")[0]
                let props = require(`../${commanddir}/${command}`);
                console.log(`Attempting to load Command ${command}`)
                commandmap.set(command, props)
                if (props.help && helplist) helplist.push(command)
                if (!props.alias) return

            })
        })
    } else throw new CustomError("LoadError", `CommandDirectory ${commanddir} does not exist.`)
}
/**
 * 
 * @param {string} eventdir Event directory relative to project root
 * @param {EventEmitter} eventemitter an EventEmitter 
 * @example loadEvents("events/twitch", client)
 * @throws {LoadError} missing command directory
 */
exports.loadEvents = (eventdir, eventemitter) => {
    var readeventdir = "./" + eventdir
    if (existsSync(readeventdir)) {
        readdir(`./${readeventdir}/`, (err, files) => {
            if (err) return console.error("Error reading discord events directory:", err);
            files.forEach(file => {
                if (!(file.endsWith(".js"))) return;
                let eventname = file.split(".")[0];
                const { event } = require(`../${eventdir}/${eventname}`);
                eventemitter.on(eventname, event.bind(null, this));
            });
        });
    } else throw new CustomError("LoadError", `EventDirectory ${eventdir} does not exist.`)
}

/**
 * 
 * @param {number} watchtime raw watchtime as stored in Database
 * @returns {string} Watchtime String
 * @throws {TypeError} Watchtime has to be a Number
 */
exports.calcWatchtime = (watchtime) => {
    if (!watchtime instanceof Number) throw new CustomError("TypeError", "Watchtime has to be a Number")
    var timeTotalMinutes = Math.floor(watchtime / 2)
    var timeMinutes = timeTotalMinutes % 60
    var timeHours = (timeTotalMinutes % 1440) - timeMinutes
    var timeDays = (timeTotalMinutes - timeMinutes) - timeHours
    timeHours /= 60
    timeDays /= 1440
    return `${timeDays} Tag(en), ${timeHours} Stunde(n) und ${timeMinutes} Minute(n)`
}