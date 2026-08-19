CREATE TABLE `github_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_login` text NOT NULL,
	`target_type` text NOT NULL,
	`repository_selection` text NOT NULL,
	`suspended_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `hub_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_github_installations_user_id` ON `github_installations` (`user_id`);--> statement-breakpoint
CREATE TABLE `hub_users` (
	`id` text PRIMARY KEY NOT NULL,
	`workos_user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_hub_users_workos_user_id` ON `hub_users` (`workos_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_hub_users_email` ON `hub_users` (`email`);--> statement-breakpoint
CREATE TABLE `plugin_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL,
	`version` text NOT NULL,
	`channel` text DEFAULT 'stable' NOT NULL,
	`manifest_json` text NOT NULL,
	`source_json` text NOT NULL,
	`compatibility_json` text NOT NULL,
	`entry_ids_json` text DEFAULT '[]' NOT NULL,
	`before_json` text DEFAULT '[]' NOT NULL,
	`after_json` text DEFAULT '[]' NOT NULL,
	`published_at` text NOT NULL,
	`yanked` integer DEFAULT false NOT NULL,
	`unpacked_size` integer,
	`file_count` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plugin_id`) REFERENCES `plugins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plugin_versions_plugin_version` ON `plugin_versions` (`plugin_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_plugin_versions_published_at` ON `plugin_versions` (`published_at`);--> statement-breakpoint
CREATE TABLE `plugins` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`package_name` text NOT NULL,
	`display_name` text NOT NULL,
	`summary` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`repository` text NOT NULL,
	`homepage` text,
	`license` text,
	`categories_json` text DEFAULT '[]' NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`icon_url` text,
	`screenshots_json` text DEFAULT '[]' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`deprecated` integer DEFAULT false NOT NULL,
	`replacement` text,
	`latest_version` text NOT NULL,
	`dist_tags_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plugins_slug` ON `plugins` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plugins_package_name` ON `plugins` (`package_name`);--> statement-breakpoint
CREATE INDEX `idx_plugins_updated_at` ON `plugins` (`updated_at`);--> statement-breakpoint
CREATE TABLE `profile_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`version` text NOT NULL,
	`manifest_json` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_versions_profile_version` ON `profile_versions` (`profile_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_profile_versions_published_at` ON `profile_versions` (`published_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_user_id` text,
	`owner` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`latest_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `hub_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_slug` ON `profiles` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_profiles_owner_user_id` ON `profiles` (`owner_user_id`);