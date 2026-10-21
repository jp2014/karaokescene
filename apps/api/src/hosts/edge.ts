import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { app } from '../app.ts';
import { schema, setDb, type DB } from '../db/client.ts';
import { SUPABASE_ROOT_CA } from '../db/supabase-ca.ts';
import { setWaitUntil } from '../lib/defer.ts';
import { setRealtimeTransport, supabaseBroadcast } from '../lib/realtime.ts';
import { setMediaStore, supabaseStorage } from '../lib/storage.ts';
import { supabaseConfig } from '../lib/supabase.ts';

/**
 * Production host: a Supabase Edge Function named `api`, so requests arrive as /api/...
 * and match the app's routes as-is. Bundled by scripts/build-edge.ts. Nothing here (or in
 * app.ts) imports the demo, PGlite or the local adapters, so none of it ships.
 */
declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): unknown };
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const supabase = supabaseConfig();
if (!supabase) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

// SUPABASE_DB_URL is a direct connection: every isolate's pool counts against Postgres's
// max_connections, and bursts exhausted it. Deployed, the API must use DB_POOLER_URL
// (Supavisor transaction mode, set by scripts/release.mjs); local `functions serve` has no pooler.
const pooler = process.env.DB_POOLER_URL;
if (!pooler && process.env.DENO_DEPLOYMENT_ID) throw new Error('DB_POOLER_URL must be set in production');
const connectionString = pooler || process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error('DB_POOLER_URL or SUPABASE_DB_URL must be set');

// node-postgres, not postgres.js: postgres.js pipelines queries, which the transaction pooler
// can answer out of order. The pooler's certificate chains to Supabase's own root CA, which the
// Edge Runtime (always verifying) must be given. Idle isolates release their connections.
const pool = new pg.Pool({
  connectionString,
  ssl: pooler ? { ca: SUPABASE_ROOT_CA } : undefined,
  max: 3,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});
pool.on('error', (err) => console.error('idle database connection failed:', err));
setDb(drizzle(pool, { schema }) as unknown as DB);
setRealtimeTransport(supabaseBroadcast(supabase));
setMediaStore(supabaseStorage(supabase));
if (typeof EdgeRuntime !== 'undefined') setWaitUntil((p) => EdgeRuntime!.waitUntil(p));

Deno.serve((req) => app.fetch(req));
