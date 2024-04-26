import { boolean, integer, pgTable, text, unique, varchar } from "drizzle-orm/pg-core";
import { streamers } from "./streamer.js";

export const commands = pgTable(
    "commands",
    {
        channel: varchar("channel", { length: 25 }).references(() => streamers.name),
        permission: integer("permission").notNull().default(0),
        command: text("command").notNull(),
        enabled: boolean("enabled").default(true),
    },
    (t) => ({ uk: unique().on(t.channel, t.command) }),
);
