import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { reputation } from './service.ts';

export const reputationRoutes = new Hono<AppEnv>()
  .get('/catalog', (c) => c.json(reputation.catalog))
  .get('/awardable/:userId', async (c) => c.json(await reputation.awardable(requireViewer(c), c.req.param('userId'))))
  .post('/award', zValidator('json', z.object({ recipientId: z.string(), badgeKey: z.string() })), async (c) => {
    const { recipientId, badgeKey } = c.req.valid('json');
    return c.json(await reputation.award(requireViewer(c), recipientId, badgeKey));
  });
