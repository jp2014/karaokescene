import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../lib/context.ts';
import { venues } from '../modules/venues/service.ts';
import { demo } from './service.ts';

/** Mounted at /api/demo by the local Node host only. Never part of a production deploy. */
export const demoRoutes = new Hono<AppEnv>()
  .get('/accounts', async (c) => c.json(await demo.accounts()))
  .post('/sign-in', zValidator('json', z.object({ userId: z.string() })), async (c) => c.json(await demo.signIn(c.req.valid('json').userId)))
  .post('/reset', async (c) => c.json(await demo.reset()))
  .get('/clock', (c) => c.json(demo.clockState()))
  .put('/clock', zValidator('json', z.object({ target: z.object({ dayOfWeek: z.number().int().min(0).max(6), minutes: z.number().int().min(0).max(1439) }).nullable() })), async (c) =>
    c.json(await demo.setClock(c.req.valid('json').target)),
  )
  .post('/crowd/:venueId', zValidator('json', z.object({ count: z.number().int().min(1).max(30) })), async (c) =>
    c.json(await demo.crowd(c.req.param('venueId'), c.req.valid('json').count)),
  )
  .post('/auto-leave/:venueId', async (c) => c.json(await demo.autoLeave(c.req.param('venueId'))))
  .post('/referral', async (c) => c.json(await demo.referralJoin(requireViewer(c))))
  .post('/upgrade', async (c) => c.json(await demo.upgrade(requireViewer(c))))
  .put('/premiere/:venueId', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    await venues.update(requireViewer(c), c.req.param('venueId'), { isPremiere: c.req.valid('json').on });
    return c.json({ ok: true });
  });

export type DemoApiType = typeof demoRoutes;
