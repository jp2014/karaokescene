import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.ts';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

/**
 * The app's database. Each host picks the driver and calls `setDb` before serving:
 * PGlite (embedded Postgres) locally, postgres.js against Supabase in production.
 * Modules read `db` at call time, so this live binding always points at the current one.
 */
export let db: DB = new Proxy({} as DB, {
  get() {
    throw new Error('Database not initialised: the host must call setDb() first');
  },
});

export function setDb(next: DB) {
  db = next;
}
