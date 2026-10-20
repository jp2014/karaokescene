import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { promo } from './service.ts';

export const promoRoutes = new Hono<AppEnv>()
  /** The viewer's share reminders (Auto Promote, special reminders). */
  .get('/posts', async (c) => c.json(await promo.list(requireViewer(c))))
  .post('/blast', zValidator('json', z.object({ message: z.string().min(3).max(280) })), async (c) => c.json(await promo.blast(requireViewer(c, 'kj'), c.req.valid('json').message)));
