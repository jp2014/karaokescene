CREATE TABLE "app"."coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"venue_id" text NOT NULL,
	"singer_id" text NOT NULL,
	"title" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"expires_at" bigint NOT NULL,
	"redeemed_at" bigint,
	"created_at" bigint NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "app"."kj_venue_links" ADD COLUMN "auto_promote" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."song_requests" ADD COLUMN "decided_at" bigint;--> statement-breakpoint
ALTER TABLE "app"."specials" ADD COLUMN "auto_post" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "claimed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "venue_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "hours" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "happy_hours" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "food_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD COLUMN "menu_url" text;--> statement-breakpoint
CREATE INDEX "coupons_singer_idx" ON "app"."coupons" USING btree ("singer_id");