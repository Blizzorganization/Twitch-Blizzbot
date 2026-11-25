import { Console } from "node:console";
import { Transform } from "node:stream";

const ts = new Transform({
    transform(chunk, enc, cb) {
        cb(null, chunk);
    },
});
const con = new Console({ stdout: ts });

/** Textabelle wie getTable im alten Bot (console.table als String), z. B. für Discord-Codeblöcke. */
export function getTable(data) {
    con.table(data);
    return (ts.read() || "").toString();
}
