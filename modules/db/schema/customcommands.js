import { integer, pgTable, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { streamers } from "./streamer.js";
export const customcommands = pgTable(
    "customcommands",
    {
        channel: varchar("channel", { length: 25 })
            .notNull()
            .references(() => streamers.name),
        command: text("command").notNull(),
        response: text("response"),
        permissions: integer("permissions"),
    },
    (t) => ({ pk: primaryKey({ columns: [t.channel, t.command] }) }),
);
