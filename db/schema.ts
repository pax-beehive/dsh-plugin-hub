import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const waitlistSignups = sqliteTable(
  "waitlist_signups",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    locale: text("locale").notNull().default("zh"),
    source: text("source").notNull().default("hero"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_waitlist_signups_email").on(table.email),
  ],
);
