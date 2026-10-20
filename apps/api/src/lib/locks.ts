import { sql } from 'drizzle-orm';
import { db, type DB } from '../db/client.ts';

/**
 * Runs `fn` in a transaction holding a per-user advisory lock, so check-then-write steps for
 * one person (submitting songs, checking out) can't interleave across requests or instances.
 * Inside `fn`, query only through `tx`: PGlite has a single connection, so using `db` there
 * would wait on the open transaction forever.
 */
export function withUserLock<T>(userId: string, fn: (tx: DB) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`user:${userId}`}))`);
    return fn(tx as unknown as DB);
  });
}
