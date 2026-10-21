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

/** Rows from `db.execute`: postgres.js returns an array, node-postgres and PGlite a result with `rows`. */
export function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}

/** Postgres unique_violation (23505), from postgres.js or PGlite, possibly wrapped by Drizzle. */
export function isUniqueViolation(err: unknown): boolean {
  for (let e = err as { code?: unknown; cause?: unknown } | undefined, i = 0; e && i < 3; e = e.cause as typeof e, i++) {
    if (e.code === '23505') return true;
  }
  return false;
}
