import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { venues } from '../venues/service.ts';
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
  .get('/praise', async (c) => {
    const viewer = c.get('viewer');
    // Venues see the praise that happened in their own room, from singers and KJs.
    const venue = viewer?.role === 'venue' ? await venues.ownedBy(viewer.id) : undefined;
    return c.json({ items: await social.praiseFeed(viewer?.id, { venueId: venue?.id }), presets: PRAISE_PRESETS, scope: venue ? { venueName: venue.name } : null });
  })
  .post('/invites', zValidator('json', z.object({ friendIds: z.array(z.string()).min(1).max(20), venueId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })), async (c) =>
    c.json(await social.inviteOut(requireViewer(c, 'singer').id, c.req.valid('json'))),
  )
  .post(
    '/praise/:userId',
    zValidator('json', z.object({ emoji: z.string().max(8), message: z.string().min(2).max(140), venueId: z.string().optional(), songId: z.string().optional() })),
    async (c) => c.json(await social.givePraise(requireViewer(c).id, c.req.param('userId'), c.req.valid('json'))),
  );
