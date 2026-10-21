CREATE TABLE "app"."catalog_syncs" (
	"name" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"songs" integer NOT NULL,
	"synced_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."songs" ADD COLUMN "base_rank" integer;--> statement-breakpoint
CREATE INDEX "songs_base_rank_idx" ON "app"."songs" USING btree ("base_rank");