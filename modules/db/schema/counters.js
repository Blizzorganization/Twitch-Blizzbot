import { integer, pgTable, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { streamers } from "./streamer.js";

export const counters = pgTable(
    "counters",
    {
        channel: varchar("channel", { length: 25 })
            .notNull()
            .references(() => streamers.name),
        name: text("name"),
        cur: integer("cur").default(0),
        inc: integer("inc").default(1),
    },
    (t) => ({ pk: primaryKey({ columns: [t.channel, t.name] }) }),
);
