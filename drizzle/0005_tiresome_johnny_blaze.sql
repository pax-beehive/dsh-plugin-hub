ALTER TABLE `plugins` ADD `owner_user_id` text REFERENCES hub_users(id);--> statement-breakpoint
CREATE INDEX `idx_plugins_owner_user_id` ON `plugins` (`owner_user_id`);