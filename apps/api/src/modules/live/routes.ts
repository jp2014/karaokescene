import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { live } from './service.ts';

export const liveRoutes = new Hono<AppEnv>()
  .get('/booth', async (c) => c.json(await live.booth(requireViewer(c, 'kj'))))
  .get('/mine', async (c) => c.json(await live.mine(requireViewer(c))))
  .post('/requests', zValidator('json', z.object({ songId: z.string(), source: z.enum(['list', 'roulette', 'search']) })), async (c) => {
    const { songId, source } = c.req.valid('json');
    return c.json(await live.request(requireViewer(c), songId, source));
  })
  .delete('/requests/:id', async (c) => {
    await live.cancel(requireViewer(c), c.req.param('id'));
    return c.json({ ok: true });
  })
  .put('/requests/:id/status', zValidator('json', z.object({ status: z.enum(['queued', 'up', 'done', 'skipped']) })), async (c) =>
    c.json(await live.setStatus(requireViewer(c, 'kj'), c.req.param('id'), c.req.valid('json').status)),
  )
  .post('/pull', zValidator('json', z.object({ singerId: z.string(), songId: z.string() })), async (c) => {
    const { singerId, songId } = c.req.valid('json');
    return c.json(await live.pullFromList(requireViewer(c, 'kj'), singerId, songId));
  });
