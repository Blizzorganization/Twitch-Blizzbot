import { foreignKey, pgTable, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { customcommands } from "./customcommands.js";

export const aliases = pgTable(
    "aliases",
    {
        alias: text("alias"),
        command: text("command").notNull(),
        channel: varchar("channel", { length: 25 }).notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.channel, t.alias] }),
        fk: foreignKey({
            columns: [t.channel, t.command],
            foreignColumns: [customcommands.channel, customcommands.command],
        }),
    }),
);
