CREATE TABLE `npm_discovery_cursors` (
	`query` text PRIMARY KEY NOT NULL,
	`next_offset` integer DEFAULT 0 NOT NULL,
	`last_run_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `npm_sync_packages` (
	`package_name` text PRIMARY KEY NOT NULL,
	`discovery_source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`package_kind` text,
	`npm_modified_at` text,
	`last_synced_at` text,
	`next_sync_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_error` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_npm_sync_packages_due` ON `npm_sync_packages` (`status`,`next_sync_at`);--> statement-breakpoint
CREATE INDEX `idx_npm_sync_packages_updated_at` ON `npm_sync_packages` (`updated_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `package_name` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `repository` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_package_name` ON `profiles` (`package_name`);--> statement-breakpoint
INSERT INTO `npm_sync_packages` (`package_name`, `discovery_source`, `status`, `package_kind`)
SELECT `package_name`, 'existing', 'accepted', 'plugin' FROM `plugins`
WHERE true
ON CONFLICT(`package_name`) DO NOTHING;
