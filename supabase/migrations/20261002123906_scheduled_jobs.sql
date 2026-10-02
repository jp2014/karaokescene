-- Scheduled maintenance. One implementation for every environment: in production pg_cron
-- runs it (see the *_supabase_platform migration); locally the Node host calls it every
-- minute with the demo clock's "now".
CREATE OR REPLACE FUNCTION app.run_scheduled_jobs(now_ms bigint DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)::bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Close out forgotten check-ins (8h, matching CHECKIN_TTL_MS in the presence module).
  -- Credit them the same 2h stay Peak Hours assumes for an open check-in.
  UPDATE app.checkins
     SET checked_out_at = checked_in_at + 2 * 3600000::bigint, checkout_reason = 'closing'
   WHERE checked_out_at IS NULL AND checked_in_at < now_ms - 8 * 3600000::bigint;

  -- End "KJ Now" sessions nobody ended (12h, matching the presence module).
  UPDATE app.kj_sessions
     SET ended_at = started_at + 12 * 3600000::bigint
   WHERE ended_at IS NULL AND started_at < now_ms - 12 * 3600000::bigint;

  -- Scheduled promo posts go out when they're due.
  UPDATE app.promo_posts SET status = 'posted' WHERE status = 'scheduled' AND scheduled_for <= now_ms;

  -- Keep the notifications table small: drop read notifications after 30 days.
  DELETE FROM app.notifications WHERE read_at IS NOT NULL AND created_at < now_ms - 30 * 86400000::bigint;
END;
$$;
