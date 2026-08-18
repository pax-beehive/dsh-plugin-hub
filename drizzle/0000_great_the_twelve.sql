CREATE TABLE `waitlist_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text DEFAULT 'zh' NOT NULL,
	`source` text DEFAULT 'hero' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_waitlist_signups_email` ON `waitlist_signups` (`email`);