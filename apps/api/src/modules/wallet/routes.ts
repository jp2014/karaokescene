import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { wallet } from './service.ts';

export const walletRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await wallet.mine(requireViewer(c, 'singer'))))
  .get('/issued', async (c) => c.json(await wallet.issued(requireViewer(c, 'venue'))))
  .post(
    '/coupons',
    zValidator('json', z.object({ singerId: z.string(), title: z.string().min(2).max(60), details: z.string().max(160).default(''), validDays: z.number().int().min(1).max(90).default(14) })),
    async (c) => c.json(await wallet.award(requireViewer(c, 'venue'), c.req.valid('json'))),
  )
  .post('/redeem', zValidator('json', z.object({ code: z.string().min(4).max(20) })), async (c) => c.json(await wallet.redeem(requireViewer(c, 'venue'), c.req.valid('json').code)));
