CREATE TABLE `abuse_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`package_name` text,
	`reported_url` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`reporter_email` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_abuse_reports_status` ON `abuse_reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_abuse_reports_package_name` ON `abuse_reports` (`package_name`);--> statement-breakpoint
CREATE INDEX `idx_abuse_reports_created_at` ON `abuse_reports` (`created_at`);