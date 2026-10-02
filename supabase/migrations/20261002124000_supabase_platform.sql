-- Supabase-only setup: pg_cron, Storage and Realtime authorization.
-- Not in Drizzle's journal (meta/_journal.json), so local PGlite never runs it.

-- Scheduled jobs ------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('ks-scheduled-jobs', '*/5 * * * *', 'select app.run_scheduled_jobs()');

-- Media storage -------------------------------------------------------------
-- Public read (gallery photos are public on venue pages); only the API writes, using
-- the service role, so no insert/update policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/*', 'video/*'])
on conflict (id) do nothing;

-- Realtime ------------------------------------------------------------------
-- The API broadcasts small "something changed" signals on private channels:
--   user:<app user id>  notifications for one person
--   venue:<venue id>    the live queue and who's here at one venue
--   scene               check-ins anywhere (map counts)
-- Signed-in users may listen to their own user topic and to venue/scene topics.

create or replace function app.current_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id from app.users where auth_id = auth.uid()
$$;

revoke all on function app.current_user_id() from public;
grant usage on schema app to authenticated;
grant execute on function app.current_user_id() to authenticated;

create policy "ks: listen to own and public topics"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    realtime.topic() = 'scene'
    or realtime.topic() like 'venue:%'
    or realtime.topic() = 'user:' || app.current_user_id()
  )
);
