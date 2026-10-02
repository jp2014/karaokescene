import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { schema, setDb, type DB } from '../db/client.ts';

export const apiRoot = resolve(import.meta.dirname, '../..');
const migrationsFolder = resolve(apiRoot, '../../supabase/migrations');

/** Loads apps/api/.env if there is one (it's optional). */
export function loadLocalEnv() {
  const file = resolve(apiRoot, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

/**
 * Local database: embedded Postgres (PGlite) in apps/api/data/pglite, or DATABASE_URL for
 * a real server. Runs the same migrations Supabase gets.
 */
export async function connectLocalDb() {
  if (process.env.DATABASE_URL) {
    const d = drizzlePostgres(postgres(process.env.DATABASE_URL, { max: 5, onnotice: () => {} }), { schema });
    await migratePostgres(d, { migrationsFolder });
    setDb(d as unknown as DB);
  } else {
    const d = drizzlePglite(new PGlite(resolve(apiRoot, 'data/pglite')), { schema });
    await migratePglite(d, { migrationsFolder });
    setDb(d as unknown as DB);
  }
}
