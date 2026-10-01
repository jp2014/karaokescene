import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';
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

const connect = () => createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
let client = connect();
// Queries go through this proxy so reopenDb() can swap the connection underneath `db`.
const live = new Proxy({} as Client, {
  get(_, key) {
    const value = Reflect.get(client, key);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
export const db = drizzle(live, { schema });
export type DB = typeof db;
export { schema };

/** Reconnect after the database file was replaced on disk (see apps/api/netlify/api.ts). */
export function reopenDb() {
  client.close();
  client = connect();
}

/** The local database file, or null when DATABASE_URL points at a remote database. */
export const dbFile = url.startsWith('file:') ? url.slice(5) : null;

export async function migrateDb(migrationsFolder = resolve(apiRoot, 'drizzle')) {
  await migrate(db, { migrationsFolder });
}
