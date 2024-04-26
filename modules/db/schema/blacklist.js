import { pgTable, smallint, text, unique, varchar } from "drizzle-orm/pg-core";
import { streamers } from "./streamer.js";

export const blacklist = pgTable(
    "blacklist",
    {
        channel: varchar("channel", { length: 25 }).references(() => streamers.name),
        blword: text("blword"),
        action: smallint("action").notNull().default(0),
    },
    (t) => ({ uk: unique().on(t.blword, t.channel) }),
);
