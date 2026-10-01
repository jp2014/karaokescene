import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { promo } from './service.ts';

export const promoRoutes = new Hono<AppEnv>()
  .get('/posts', async (c) => c.json(await promo.list(requireViewer(c))))
  .post(
    '/posts',
    zValidator(
      'json',
      z.object({
        body: z.string().min(3).max(600),
        networks: z.array(z.enum(['facebook', 'instagram', 'karaokescene'])).min(1),
        scheduledFor: z.number(),
        venueId: z.string().optional(),
      }),
    ),
    async (c) => c.json(await promo.schedule(requireViewer(c), c.req.valid('json'))),
  )
  .post('/upgrade', async (c) => c.json(await promo.upgrade(requireViewer(c))));
