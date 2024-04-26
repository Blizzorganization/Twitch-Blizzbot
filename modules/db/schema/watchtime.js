import { integer, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";
import { streamers } from "./streamer.js";

export const watchtime = pgTable(
    "watchtime",
    {
        channel: varchar("channel", { length: 25 })
            .notNull()
            .references(() => streamers.name),
        viewer: varchar("viewer", { length: 25 }).notNull(),
        watchtime: integer("watchtime").default(0),
        month: varchar("month", { length: 7 }).notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.channel, t.viewer, t.month] }),
    }),
);
