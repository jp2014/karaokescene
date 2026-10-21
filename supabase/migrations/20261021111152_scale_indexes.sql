CREATE INDEX "badge_awards_recipient_idx" ON "app"."badge_awards" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "app"."blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "checkins_user_idx" ON "app"."checkins" USING btree ("user_id","venue_id");--> statement-breakpoint
CREATE INDEX "checkins_open_idx" ON "app"."checkins" USING btree ("checked_in_at") WHERE "app"."checkins"."checked_out_at" is null;--> statement-breakpoint
CREATE INDEX "favorites_target_idx" ON "app"."favorites" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "friendships_addressee_idx" ON "app"."friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "kj_sessions_open_kj_idx" ON "app"."kj_sessions" USING btree ("kj_id") WHERE "app"."kj_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "kj_sessions_open_venue_idx" ON "app"."kj_sessions" USING btree ("venue_id") WHERE "app"."kj_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "praise_to_idx" ON "app"."praise" USING btree ("to_id","created_at");--> statement-breakpoint
CREATE INDEX "praise_created_idx" ON "app"."praise" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "song_requests_session_idx" ON "app"."song_requests" USING btree ("kj_session_id","singer_id");--> statement-breakpoint
CREATE INDEX "songbook_entries_song_idx" ON "app"."songbook_entries" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "songs_title_artist_md5_idx" ON "app"."songs" USING btree (md5(lower("title")),md5(lower("artist")));