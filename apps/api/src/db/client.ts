import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.ts';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * DATABASE_URL may point at a local file (default) or a remote libSQL/Turso
 * database (libsql://...), so the API can be hosted anywhere without code changes.
 */
const url = process.env.DATABASE_URL ?? `file:${resolve(apiRoot, 'data/karaoke.db')}`;
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };

export async function migrateDb(migrationsFolder = resolve(apiRoot, 'drizzle')) {
  await migrate(db, { migrationsFolder });
}
