CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `badge_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`badge_key` text NOT NULL,
	`recipient_id` text NOT NULL,
	`giver_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`method` text NOT NULL,
	`checked_in_at` integer NOT NULL,
	`checked_out_at` integer,
	`checkout_reason` text
);
--> statement-breakpoint
CREATE INDEX `checkins_venue_idx` ON `checkins` (`venue_id`,`checked_out_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`requester_id`, `addressee_id`)
);
--> statement-breakpoint
CREATE TABLE `gallery_items` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`uploader_id` text NOT NULL,
	`kind` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`hue` integer NOT NULL,
	`emoji` text NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `karaoke_nights` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`kj_id` text,
	`day_of_week` integer NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kj_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kj_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `kj_venue_links` (
	`kj_id` text NOT NULL,
	`venue_id` text NOT NULL,
	PRIMARY KEY(`kj_id`, `venue_id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`link` text,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `praise` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`venue_id` text,
	`song_id` text,
	`emoji` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promo_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`venue_id` text,
	`networks` text NOT NULL,
	`body` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`user_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`user_id`, `venue_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `song_list_entries` (
	`user_id` text NOT NULL,
	`song_id` text NOT NULL,
	`is_go_to` integer DEFAULT false NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `song_id`)
);
--> statement-breakpoint
CREATE TABLE `song_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`kj_session_id` text NOT NULL,
	`singer_id` text NOT NULL,
	`song_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `songbook_entries` (
	`kj_id` text NOT NULL,
	`song_id` text NOT NULL,
	PRIMARY KEY(`kj_id`, `song_id`)
);
--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`genre` text NOT NULL,
	`decade` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `specials` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`title` text NOT NULL,
	`price` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`days` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_hue` integer DEFAULT 300 NOT NULL,
	`avatar_emoji` text DEFAULT '🎤' NOT NULL,
	`hometown` text,
	`age_range` text,
	`favorite_night` text,
	`years_singing` integer,
	`is_pro` integer DEFAULT false NOT NULL,
	`ghost_mode` integer DEFAULT false NOT NULL,
	`privacy` text NOT NULL,
	`lat` real,
	`lng` real,
	`referred_by_id` text,
	`qr_scans` integer DEFAULT 0 NOT NULL,
	`is_premium` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`neighborhood` text NOT NULL,
	`city` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`hue` integer DEFAULT 280 NOT NULL,
	`is_premiere` integer DEFAULT false NOT NULL,
	`capacity` integer DEFAULT 80 NOT NULL,
	`vibes` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_slug_unique` ON `venues` (`slug`);