import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

/**
 * Netlify Function host for the API.
 *
 * With DATABASE_URL set (e.g. Turso) this is a plain passthrough. Otherwise the demo
 * runs on a SQLite file in /tmp that is shared between function instances through
 * Netlify Blobs: each request pulls the latest copy (a cheap 304 when unchanged), and
 * a request that changed the file pushes it back with a conditional write. If another
 * instance wrote first, the request is replayed on the newer copy. Fine for demo
 * traffic; use a real database for anything more.
 */
process.env.DATABASE_URL ??= 'file:/tmp/karaoke.db';

const KEY = 'karaoke.db';
const MAX_ATTEMPTS = 5;
type Store = ReturnType<typeof getStore>;

// Imported lazily so DATABASE_URL is set before the db client reads it.
async function init() {
  const [{ db, dbFile, migrateDb, reopenDb }, { seed }, { clock }, { app }] = await Promise.all([
    import('../src/db/client.ts'),
    import('../src/seed/seed.ts'),
    import('../src/lib/clock.ts'),
    import('../src/app.ts'),
  ]);
  // Bundling moves this file, so find the included migrations folder at runtime.
  const migrations = [resolve(process.cwd(), 'apps/api/drizzle'), resolve(process.cwd(), 'drizzle')].find(existsSync);

  if (!dbFile) {
    await migrateDb(migrations);
    if (!(await db.query.users.findFirst())) await seed();
    await clock.load();
    return (req: Request) => app.fetch(req);
  }

  const store = getStore({ name: 'demo-db', consistency: 'strong' });
  let etag: string | undefined;
  const fileHash = () => createHash('sha1').update(readFileSync(dbFile)).digest('hex');

  /** Make the local file match the shared copy. Returns false when there is no shared copy yet. */
  async function pull(store: Store) {
    const blob = await store.getWithMetadata(KEY, { type: 'arrayBuffer', etag });
    if (!blob) return false;
    if (blob.data) {
      writeFileSync(dbFile!, Buffer.from(blob.data));
      reopenDb();
      await clock.load();
    }
    // Not every Blobs backend (e.g. the local emulator) returns an ETag on reads.
    etag = blob.etag ?? (await store.list({ prefix: KEY })).blobs.find((b) => b.key === KEY)?.etag;
    return true;
  }

  async function push(store: Store) {
    const data = readFileSync(dbFile!);
    const result = etag ? await store.set(KEY, data, { onlyIfMatch: etag }) : await store.set(KEY, data, { onlyIfNew: true });
    if (result.modified) etag = result.etag;
    return result.modified;
  }

  if (!(await pull(store))) {
    await migrateDb(migrations);
    await seed();
    await clock.load();
    // Another instance may have seeded first; theirs wins.
    if (!(await push(store))) await pull(store);
  }
  await migrateDb(migrations);

  async function handle(req: Request) {
    for (let attempt = 1; ; attempt++) {
      await pull(store);
      const before = fileHash();
      const res = await app.fetch(req.clone());
      if (fileHash() === before || (await push(store))) return res;
      if (attempt === MAX_ATTEMPTS) return Response.json({ error: 'The scene is busy, try again' }, { status: 503 });
      // Lost the race: forget our version so the next pull downloads the winner's.
      etag = undefined;
    }
  }

  // One request at a time per instance, so pull → handle → push never interleaves.
  let queue: Promise<unknown> = Promise.resolve();
  return (req: Request) => {
    const run = queue.then(() => handle(req));
    queue = run.catch(() => {});
    return run;
  };
}

let ready: ReturnType<typeof init> | undefined;
export default async (req: Request) => {
  ready ??= init().catch((err) => {
    ready = undefined;
    throw err;
  });
  return (await ready)(req);
};

export const config: Config = { path: '/api/*' };
