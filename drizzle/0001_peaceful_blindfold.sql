ALTER TABLE `waitlist_signups` ADD `unsubscribe_token` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `unsubscribed_at` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `followup_status` text DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `followup_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `followup_result` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `followup_last_error` text;--> statement-breakpoint
ALTER TABLE `waitlist_signups` ADD `followup_sent_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_waitlist_signups_unsubscribe_token` ON `waitlist_signups` (`unsubscribe_token`);