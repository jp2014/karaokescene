import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { sql } from 'drizzle-orm';
import { app } from '../app.ts';
import { db } from '../db/client.ts';
import { clock } from '../lib/clock.ts';
import { setRealtimeTransport, supabaseBroadcast } from '../lib/realtime.ts';
import { setMediaStore, supabaseStorage } from '../lib/storage.ts';
import { supabaseConfig } from '../lib/supabase.ts';
import { apiRoot, connectLocalDb, loadLocalEnv } from '../local/db.ts';
import { localRealtime, localRealtimeRoutes } from '../local/realtime.ts';
import { localStorage, serveLocalMedia } from '../local/storage.ts';

/**
 * Local host: `pnpm dev` / `pnpm start`. Zero setup by default:
 * - Postgres via PGlite in apps/api/data (or DATABASE_URL for a real server)
 * - realtime over SSE, media on disk, scheduled jobs on a timer
 * - the demo: seeded scene, persona sign-in and Demo controls (DEMO=off to disable)
 * Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in apps/api/.env to use real Supabase
 * Auth, Realtime and Storage instead.
 */
loadLocalEnv();
await connectLocalDb();

const supabase = supabaseConfig();
const mediaDir = resolve(apiRoot, 'data/media');
if (supabase) {
  setRealtimeTransport(supabaseBroadcast(supabase));
  setMediaStore(supabaseStorage(supabase));
} else {
  setRealtimeTransport(localRealtime);
  setMediaStore(localStorage(mediaDir));
  app.route('/api/realtime/local', localRealtimeRoutes);
  app.use('/api/media/*', serveLocalMedia(mediaDir));
}

if (process.env.DEMO !== 'off') {
  const { installDemo } = await import('../demo/index.ts');
  await installDemo(app);
}

// pg_cron runs this in production; locally a timer does, on the (possibly time-travelled) demo clock.
const runJobs = () => db.execute(sql`select app.run_scheduled_jobs(${clock.now()})`).catch((err) => console.error('scheduled jobs failed:', err));
await runJobs();
setInterval(runJobs, 60_000);

// `pnpm start`: if the web app has been built, serve it from the same origin (one process to host).
const webDist = resolve(apiRoot, '../web/dist');
if (existsSync(webDist)) {
  const indexHtml = readFileSync(resolve(webDist, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', (c) => (c.req.path.startsWith('/api') ? c.notFound() : c.html(indexHtml)));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => console.log(`🎤 Karaoke Scene API on http://localhost:${port}/api`));
