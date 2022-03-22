import { ok } from "assert";
import { readdirSync } from "fs";
import { describe, it } from "mocha";

for (const command of readdirSync("./commands/discord/slash").filter((f) => f.endsWith(".js"))) {
    const commandModule = await import(`../commands/discord/slash/${command}`);
    describe(`Slash Command "${command.replace(".js", "")}"`, () => {
        it("should export a data field", async () => {
            ok(commandModule.data);
        });
        it("should export an execute method", () => {
            ok(commandModule.execute);
        });
    });
}
