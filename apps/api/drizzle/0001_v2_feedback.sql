CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`venue_id` text NOT NULL,
	`singer_id` text NOT NULL,
	`title` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`expires_at` integer NOT NULL,
	`redeemed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `coupons_singer_idx` ON `coupons` (`singer_id`);--> statement-breakpoint
ALTER TABLE `gallery_items` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `kj_venue_links` ADD `auto_promote` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `song_requests` ADD `decided_at` integer;--> statement-breakpoint
ALTER TABLE `specials` ADD `auto_post` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `venues` ADD `claimed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `venues` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `venues` ADD `photo_url` text;--> statement-breakpoint
ALTER TABLE `venues` ADD `venue_types` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `venues` ADD `hours` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `venues` ADD `happy_hours` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `venues` ADD `food_available` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `venues` ADD `menu_url` text;--> statement-breakpoint
UPDATE `song_requests` SET `status` = CASE `status` WHEN 'queued' THEN 'submitted' WHEN 'up' THEN 'accepted' WHEN 'done' THEN 'accepted' ELSE 'withdrawn' END WHERE `status` IN ('queued', 'up', 'done', 'skipped');
