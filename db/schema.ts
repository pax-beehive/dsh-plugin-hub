import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const waitlistSignups = sqliteTable(
  "waitlist_signups",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    locale: text("locale").notNull().default("zh"),
    source: text("source").notNull().default("hero"),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    consentVersion: text("consent_version").notNull().default("2026-08-17"),
    unsubscribeToken: text("unsubscribe_token"),
    unsubscribedAt: text("unsubscribed_at"),
    resubscribedAt: text("resubscribed_at"),
    followupStatus: text("followup_status").notNull().default("not_sent"),
    followupAttempts: integer("followup_attempts").notNull().default(0),
    followupResult: text("followup_result"),
    followupLastError: text("followup_last_error"),
    followupSentAt: text("followup_sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_waitlist_signups_email").on(table.email),
    uniqueIndex("idx_waitlist_signups_unsubscribe_token").on(
      table.unsubscribeToken,
    ),
  ],
);

export const waitlistRateLimits = sqliteTable("waitlist_rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(1),
  windowStartedAt: integer("window_started_at").notNull(),
});
