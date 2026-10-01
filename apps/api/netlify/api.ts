import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from '@netlify/functions';

/**
 * Netlify Function host for the API. Without DATABASE_URL (e.g. Turso) the demo
 * runs on a SQLite file in /tmp, migrated and seeded on each cold start.
 */
process.env.DATABASE_URL ??= 'file:/tmp/karaoke.db';

const ready = (async () => {
  const { db, migrateDb } = await import('../src/db/client.ts');
  const { seed } = await import('../src/seed/seed.ts');
  const { clock } = await import('../src/lib/clock.ts');
  const { app } = await import('../src/app.ts');

  // Bundling moves this file, so find the included migrations folder at runtime.
  const migrations = [resolve(process.cwd(), 'apps/api/drizzle'), resolve(process.cwd(), 'drizzle')].find(existsSync);
  await migrateDb(migrations);
  if (!(await db.query.users.findFirst())) await seed();
  await clock.load();
  return app;
})();

export default async (req: Request) => (await ready).fetch(req);

export const config: Config = { path: '/api/*' };
