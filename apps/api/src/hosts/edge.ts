import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { app } from '../app.ts';
import { schema, setDb, type DB } from '../db/client.ts';
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
const dbUrl = process.env.SUPABASE_DB_URL;
if (!supabase || !dbUrl) throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL must be set');

// prepare: false so it also works through Supavisor's transaction pooler.
setDb(drizzle(postgres(dbUrl, { prepare: false, max: 3 }), { schema }) as unknown as DB);
setRealtimeTransport(supabaseBroadcast(supabase));
setMediaStore(supabaseStorage(supabase));
if (typeof EdgeRuntime !== 'undefined') setWaitUntil((p) => EdgeRuntime!.waitUntil(p));

Deno.serve((req) => app.fetch(req));
