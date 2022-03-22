import { equal, ok } from "assert";
import { readdirSync } from "fs";
import { describe, it } from "mocha";

for (const commandType of readdirSync("./commands/twitch")) {
    for (const command of readdirSync(`./commands/twitch/${commandType}`)) {
        const commandModule = await import(`../commands/twitch/${commandType}/${command}`);

        describe(`Twitch Command "${commandType}/${command.replace(".js", "")}"`, () => {
            it('Should end with ".js"', () => command.endsWith(".js"));
            it("should have a help property", () => {
                equal(typeof commandModule.help, "boolean");
            });
            it("should have a perm property", () => {
                equal(typeof commandModule.perm, "number");
            });
            it("should have an alias property", () => {
                ok(Array.isArray(commandModule.alias));
            });
            it("should have a run property", () => {
                equal(typeof commandModule.run, "function");
            });
        });
    }
}
