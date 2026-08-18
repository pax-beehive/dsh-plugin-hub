CREATE TABLE `waitlist_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`window_started_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `referrer` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `utm_source` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `utm_medium` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `utm_campaign` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `consent_version` text DEFAULT '2026-08-17' NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `resubscribed_at` text;