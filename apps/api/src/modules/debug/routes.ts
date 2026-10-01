import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { debug } from './service.ts';

export const debugRoutes = new Hono<AppEnv>()
  .post('/reset', async (c) => c.json(await debug.reset()))
  .get('/clock', (c) => c.json(debug.clockState()))
  .put('/clock', zValidator('json', z.object({ target: z.object({ dayOfWeek: z.number().int().min(0).max(6), minutes: z.number().int().min(0).max(1439) }).nullable() })), async (c) =>
    c.json(await debug.setClock(c.req.valid('json').target)),
  )
  .post('/crowd/:venueId', zValidator('json', z.object({ count: z.number().int().min(1).max(30) })), async (c) =>
    c.json(await debug.crowd(c.req.param('venueId'), c.req.valid('json').count)),
  )
  .post('/auto-leave/:venueId', async (c) => c.json(await debug.autoLeave(c.req.param('venueId'))))
  .post('/referral', async (c) => c.json(await debug.referralJoin(requireViewer(c))));
