// Loads catalog/base-songs.csv into the catalog (see `baseCatalog` in src/modules/songs/service.ts).
// Release: scripts/release.mjs runs it after migrations with DATABASE_URL set to the session pooler.
// Locally (stop `pnpm dev` first): pnpm db:base-songs. --force resyncs an unchanged file.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { schema, setDb, type DB } from '../src/db/client.ts';
import { SUPABASE_ROOT_CA } from '../src/db/supabase-ca.ts';
import { connectLocalDb, loadLocalEnv } from '../src/local/db.ts';
import { baseCatalog } from '../src/modules/songs/service.ts';

const text = readFileSync(resolve(import.meta.dirname, '../catalog/base-songs.csv'), 'utf8');
const url = process.env.BASE_SONGS_DATABASE_URL;
let pool: pg.Pool | undefined;
if (url) {
  // Never migrates: the release has already pushed migrations with the Supabase CLI.
  const pooled = new URL(url).hostname.endsWith('.pooler.supabase.com');
  pool = new pg.Pool({ connectionString: url, ssl: pooled ? { ca: SUPABASE_ROOT_CA } : undefined, max: 1 });
  setDb(drizzle(pool, { schema }) as unknown as DB);
} else {
  loadLocalEnv();
  await connectLocalDb();
}
const started = Date.now();
try {
  const result = await baseCatalog.sync(text, { force: process.argv.includes('--force') });
  const took = `${((Date.now() - started) / 1000).toFixed(1)}s`;
  console.log(result.changed
    ? `✓ Base catalog synced: ${result.songs} songs (${result.skipped} lines skipped) in ${took}`
    : `✓ Base catalog unchanged (${result.songs} songs)`);
} finally {
  await pool?.end();
}
process.exit(0);
