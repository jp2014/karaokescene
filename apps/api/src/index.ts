import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app } from './app.ts';
import { db, migrateDb } from './db/client.ts';
import { clock } from './lib/clock.ts';
import { seed } from './seed/seed.ts';

await migrateDb();
const anyUser = await db.query.users.findFirst();
if (!anyUser) {
  const result = await seed();
  console.log(`🌱 Seeded demo scene: ${result.users} users, ${result.venues} venues, ${result.live} live nights`);
}
await clock.load();

// Production: if the web app has been built, serve it from the same origin (one process to host).
const webDist = resolve(import.meta.dirname, '../../web/dist');
if (existsSync(webDist)) {
  const indexHtml = readFileSync(resolve(webDist, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', (c) => (c.req.path.startsWith('/api') ? c.notFound() : c.html(indexHtml)));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => console.log(`🎤 Karaoke Scene API on http://localhost:${port}/api`));
