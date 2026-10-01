import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { social, PRAISE_PRESETS } from './service.ts';

const on = z.object({ on: z.boolean() });

export const socialRoutes = new Hono<AppEnv>()
  .get('/circle', async (c) => c.json(await social.circle(requireViewer(c).id)))
  .post('/friends/:userId', async (c) => c.json(await social.requestFriend(requireViewer(c).id, c.req.param('userId'))))
  .post('/friends/:userId/respond', zValidator('json', z.object({ accept: z.boolean() })), async (c) =>
    c.json(await social.respond(requireViewer(c).id, c.req.param('userId'), c.req.valid('json').accept)),
  )
  .delete('/friends/:userId', async (c) => c.json(await social.unfriend(requireViewer(c).id, c.req.param('userId'))))
  .put('/blocks/:userId', zValidator('json', on), async (c) =>
    c.json(await social.setBlocked(requireViewer(c).id, c.req.param('userId'), c.req.valid('json').on)),
  )
  .put('/favorites/:type/:id', zValidator('param', z.object({ type: z.enum(['user', 'venue']), id: z.string() })), zValidator('json', on), async (c) => {
    const { type, id } = c.req.valid('param');
    return c.json(await social.setFavorite(requireViewer(c).id, type, id, c.req.valid('json').on));
  })
  .get('/praise', async (c) => c.json({ items: await social.praiseFeed(c.get('viewer')?.id), presets: PRAISE_PRESETS }))
  .post(
    '/praise/:userId',
    zValidator('json', z.object({ emoji: z.string().max(8), message: z.string().min(2).max(140), venueId: z.string().optional(), songId: z.string().optional() })),
    async (c) => c.json(await social.givePraise(requireViewer(c).id, c.req.param('userId'), c.req.valid('json'))),
  );
