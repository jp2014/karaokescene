import type { Hono } from 'hono';
import { db } from '../db/client.ts';
import { setDevTokenResolver } from '../lib/context.ts';
import { demoClock } from './clock.ts';
import { demoRoutes } from './routes.ts';
import { demo } from './service.ts';
import { seed } from './seed.ts';

/**
 * Turns a local API into the demo: persona sign-in, seeded Omaha scene, time travel and
 * the Demo controls endpoints. Only the local Node host imports this.
 */
export async function installDemo(app: Hono) {
  if (!(await db.query.users.findFirst())) {
    const result = await seed();
    console.log(`🌱 Seeded demo scene: ${result.users} users, ${result.venues} venues, ${result.live} live nights`);
  }
  await demoClock.load();
  setDevTokenResolver(demo.userForToken);
  app.route('/api/demo', demoRoutes);
}
