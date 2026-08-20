CREATE TABLE `github_source_listings` (
	`full_name` text PRIMARY KEY NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`stars` integer DEFAULT 0 NOT NULL,
	`language` text,
	`license` text,
	`topics_json` text DEFAULT '[]' NOT NULL,
	`homepage` text,
	`pushed_at` text,
	`linked_package_name` text,
	`discovery_topic` text DEFAULT 'dsh-plugin' NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_github_source_listings_stars` ON `github_source_listings` (`stars`);--> statement-breakpoint
CREATE INDEX `idx_github_source_listings_linked` ON `github_source_listings` (`linked_package_name`);