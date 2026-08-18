CREATE TABLE `github_installation_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`full_name` text NOT NULL,
	`is_private` integer NOT NULL,
	`default_branch` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `github_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_github_installation_repositories_unique` ON `github_installation_repositories` (`installation_id`,`repository_id`);--> statement-breakpoint
CREATE INDEX `idx_github_installation_repositories_full_name` ON `github_installation_repositories` (`full_name`);