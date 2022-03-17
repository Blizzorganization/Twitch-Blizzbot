import { existsSync, mkdirSync } from "fs";
import { EOL } from "os";
import { createLogger, format as _format, transports as _transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

if (!existsSync("./logs")) mkdirSync("./logs");
export const logger = createLogger({
    level: "silly",
    format: _format.prettyPrint({
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
            format: _format.combine(_format.uncolorize(), _format.simple()),
            maxFiles: "14d",
        }),
        new _transports.Console({
            level: "info",
            format: _format.combine(
                _format.colorize({
                    level: true,
                    message: false,
                    colors: {
                        info: "green",
                        warn: "yellow",
                        error: "red",
                    },
                }),
                _format.cli(),
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
