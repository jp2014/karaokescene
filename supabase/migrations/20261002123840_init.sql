CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."badge_awards" (
	"id" text PRIMARY KEY NOT NULL,
	"badge_key" text NOT NULL,
	"recipient_id" text NOT NULL,
	"giver_id" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."blocks" (
	"user_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "blocks_user_id_blocked_id_pk" PRIMARY KEY("user_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "app"."checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"method" text NOT NULL,
	"checked_in_at" bigint NOT NULL,
	"checked_out_at" bigint,
	"checkout_reason" text
);
--> statement-breakpoint
CREATE TABLE "app"."events" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"starts_at" bigint NOT NULL,
	"ends_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."favorites" (
	"user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "favorites_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "app"."friendships" (
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "friendships_requester_id_addressee_id_pk" PRIMARY KEY("requester_id","addressee_id")
);
--> statement-breakpoint
CREATE TABLE "app"."gallery_items" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"kind" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"media_url" text,
	"hue" integer NOT NULL,
	"emoji" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."karaoke_nights" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"kj_id" text,
	"day_of_week" integer NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."kj_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"kj_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint
);
--> statement-breakpoint
CREATE TABLE "app"."kj_venue_links" (
	"kj_id" text NOT NULL,
	"venue_id" text NOT NULL,
	CONSTRAINT "kj_venue_links_kj_id_venue_id_pk" PRIMARY KEY("kj_id","venue_id")
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"read_at" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."praise" (
	"id" text PRIMARY KEY NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"venue_id" text,
	"song_id" text,
	"emoji" text NOT NULL,
	"message" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."promo_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"venue_id" text,
	"networks" jsonb NOT NULL,
	"body" text NOT NULL,
	"scheduled_for" bigint NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."rsvps" (
	"user_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"date" text NOT NULL,
	CONSTRAINT "rsvps_user_id_venue_id_date_pk" PRIMARY KEY("user_id","venue_id","date")
);
--> statement-breakpoint
CREATE TABLE "app"."song_list_entries" (
	"user_id" text NOT NULL,
	"song_id" text NOT NULL,
	"is_go_to" boolean DEFAULT false NOT NULL,
	"added_at" bigint NOT NULL,
	CONSTRAINT "song_list_entries_user_id_song_id_pk" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "app"."song_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"kj_session_id" text NOT NULL,
	"singer_id" text NOT NULL,
	"song_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."songbook_entries" (
	"kj_id" text NOT NULL,
	"song_id" text NOT NULL,
	CONSTRAINT "songbook_entries_kj_id_song_id_pk" PRIMARY KEY("kj_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "app"."songs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"genre" text NOT NULL,
	"decade" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."specials" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"title" text NOT NULL,
	"price" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"days" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_id" uuid,
	"role" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_hue" integer DEFAULT 300 NOT NULL,
	"avatar_emoji" text DEFAULT '🎤' NOT NULL,
	"hometown" text,
	"age_range" text,
	"favorite_night" text,
	"years_singing" integer,
	"is_pro" boolean DEFAULT false NOT NULL,
	"ghost_mode" boolean DEFAULT false NOT NULL,
	"privacy" jsonb NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"referred_by_id" text,
	"qr_scans" integer DEFAULT 0 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "app"."venues" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"neighborhood" text NOT NULL,
	"city" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"hue" integer DEFAULT 280 NOT NULL,
	"is_premiere" boolean DEFAULT false NOT NULL,
	"capacity" integer DEFAULT 80 NOT NULL,
	"vibes" jsonb NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "checkins_venue_idx" ON "app"."checkins" USING btree ("venue_id","checked_out_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "app"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "app"."push_tokens" USING btree ("user_id");