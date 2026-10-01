import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { qr } from './service.ts';

export const qrRoutes = new Hono<AppEnv>().post(
  '/scan',
  zValidator('json', z.object({ kind: z.enum(['u', 'v']), key: z.string().min(1) })),
  async (c) => {
    const { kind, key } = c.req.valid('json');
    return c.json(await qr.scan(requireViewer(c), kind, key));
  },
);
