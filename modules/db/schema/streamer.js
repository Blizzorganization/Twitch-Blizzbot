import { boolean, pgTable, varchar } from "drizzle-orm/pg-core";

export const streamers = pgTable("streamer", {
    name: varchar("name", { length: 25 }).primaryKey(),
    automessage: boolean("automessage"),
});
