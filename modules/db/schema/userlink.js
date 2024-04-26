import { pgTable, varchar } from "drizzle-orm/pg-core";

export const userlink = pgTable("userlink", {
    discordid: varchar("discordid", { length: 30 }).primaryKey(),
    twitchname: varchar("twitchname", { length: 25 }).notNull(),
});
