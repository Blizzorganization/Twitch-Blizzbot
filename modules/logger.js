const fs = require("fs");
const { EOL } = require("os");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

if (!fs.existsSync("./logs")) fs.mkdirSync("./logs");
const Logger = winston.createLogger({
    level: "silly",
    format: winston.format.prettyPrint({
        colorize: true,
    }),
    transports: [

        new DailyRotateFile({
            createSymlink: true,
            dirname: "logs/",
            eol: EOL,
            zippedArchive: true,
            json: false,
            symlinkName: "latest.log",
            filename: "%DATE%.log",
            level: "unused",
            format: winston.format.combine(winston.format.uncolorize(), winston.format.simple()),
            maxFiles: "14d",
        }),
        new winston.transports.Console({
            level: "info",
            format: winston.format.combine(
                winston.format.colorize({
                    level: true,
                    message: false,
                    colors: {
                        info: "green",
                        warn: "yellow",
                        error: "red",
                    },
                }),
                winston.format.cli(),
            ),
        }),
    ],
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        command: 3,
        verbose: 4,
        debug: 5,
        silly: 6,
        stdin: 7,
        unused: 8,
    },
});
module.exports = Logger;